from __future__ import annotations

import asyncio
import json
import logging
import time
import traceback
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from app.agent.context import current_event_bus, current_session_id, current_model_config
from app.agent.deep_agent import get_deep_agent
from app.artifacts.store import get_artifact_store
from app.config import get_config
from app.events.bus import AgentEvent, get_event_bus

logger = logging.getLogger(__name__)

router = APIRouter()


class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None
    model: str | None = None
    provider: str | None = None


@router.post("/chat")
async def chat(request: ChatRequest):
    session_id = request.session_id or str(uuid.uuid4())
    config = get_config()
    store = get_artifact_store()
    bus = get_event_bus()

    model_name = request.model or config.llm.model
    provider_name = request.provider or config.llm.provider

    # Clear progress for new message
    store.clear_progress(session_id)

    # Shared trace collector — accessible from both generator and background task
    all_trace_events: list[dict] = []
    trace_start = time.time()

    async def event_generator():
        # Set ContextVars before creating the background task so it inherits them
        token_bus = current_event_bus.set(bus)
        token_sid = current_session_id.set(session_id)
        token_model = current_model_config.set({"model": model_name, "provider": provider_name})

        try:
            from app.agent.router_agent import route_query
            # Step A1: Run the fast router LLM to isolate relevant datasets
            relevant_datasets = await route_query(
                message=request.message,
                model_name=model_name,
                provider_name=provider_name,
                session_id=session_id,
                bus=bus
            )

            # Start the agent in a background task that writes events to EventBus
            # Get deep agent for this model/provider combo with tailored schema context
            agent = get_deep_agent(model=model_name, provider=provider_name, relevant_datasets=relevant_datasets)
            agent_task = asyncio.create_task(
                _run_agent_with_events(
                    agent, request.message, session_id, bus, store,
                    model_name, provider_name,
                )
            )

            # Consume events from the EventBus and yield as SSE
            async for event in bus.consume(session_id):
                sse_data = {**event.data}
                # Always include agent hierarchy info for A2UI
                sse_data["agent_id"] = event.agent_id
                if event.parent_agent_id:
                    sse_data["parent_agent_id"] = event.parent_agent_id

                # Record ALL events to trace (tool_start/tool_end/agent_status included)
                all_trace_events.append({
                    "timestamp": time.time(),
                    "elapsed_s": round(time.time() - trace_start, 3),
                    "event_type": event.type,
                    "agent_id": event.agent_id,
                    "data": sse_data,
                })

                yield {
                    "event": event.type,
                    "data": json.dumps(sse_data, default=str),
                }

            # Ensure the agent task completed cleanly
            try:
                await agent_task
            except Exception:
                pass  # Errors already emitted via EventBus

        finally:
            bus.cleanup(session_id)
            current_event_bus.reset(token_bus)
            current_session_id.reset(token_sid)
            current_model_config.reset(token_model)

            # Save full trace file with ALL events
            _save_trace(session_id, request.message, all_trace_events, trace_start)

    return EventSourceResponse(event_generator())


async def _run_agent_with_events(
    agent: Any,
    message: str,
    session_id: str,
    bus: Any,
    store: Any,
    model_name: str,
    provider_name: str,
) -> None:
    """Run the LangGraph agent, translating stream updates into EventBus events.

    Emits real-time progress: a "running" step appears immediately when the model
    starts thinking, and transitions to "done" when it completes. Tool events
    (tool_start/tool_end) are handled by the EventBusMiddleware in deep_agent.py.
    """
    emitted_artifact_ids: set[str] = set()
    for existing in store.get_artifacts(session_id):
        emitted_artifact_ids.add(existing.id)

    # Track which "running" step is active so we can mark it done later
    active_step_id: str | None = None
    active_step_start: float = 0.0

    async def _emit_running(step_id: str, label: str, detail: str = "") -> None:
        """Emit a progress step with status=running."""
        nonlocal active_step_id, active_step_start
        active_step_id = step_id
        active_step_start = time.time()
        step_data = {
            "id": step_id,
            "label": label,
            "status": "running",
            "detail": detail,
            "started_at": active_step_start,
            "finished_at": None,
        }
        await bus.emit(session_id, AgentEvent(
            type="progress", data=step_data, agent_id="orchestrator",
        ))

    async def _emit_done(step_id: str, label: str, detail: str = "") -> None:
        """Emit a progress step update with status=done."""
        nonlocal active_step_id
        now = time.time()
        step_data = {
            "id": step_id,
            "label": label,
            "status": "done",
            "detail": detail,
            "started_at": active_step_start if step_id == active_step_id else now,
            "finished_at": now,
        }
        await bus.emit(session_id, AgentEvent(
            type="progress", data=step_data, agent_id="orchestrator",
        ))
        if step_id == active_step_id:
            active_step_id = None

    try:
        # ── Immediately show "Thinking..." while model works ──
        thinking_step_id = f"thinking-{uuid.uuid4().hex[:8]}"
        await _emit_running(thinking_step_id, "Thinking...")

        model_iteration = 0
        seen_first_token = False
        last_ai_content = ""  # Track whether the model produced a text response
        artifacts_this_turn: list[str] = []  # Track artifact titles created
        last_tool_output = ""  # Track last tool output for fallback
        
        in_think_block = False
        token_buffer = ""

        async for stream_item in agent.astream(
            {"messages": [{"role": "user", "content": message}]},
            config={
                "recursion_limit": 40,
                "configurable": {
                    "thread_id": session_id,
                    "model": model_name,
                    "provider": provider_name,
                    "session_id": session_id,
                },
            },
            stream_mode=["updates", "messages"],
        ):
            stream_type, chunk = stream_item

            # ── Token-level streaming (typing effect) ──
            if stream_type == "messages":
                msg_chunk, _metadata = chunk
                chunk_type = getattr(msg_chunk, "type", "")
                has_content = getattr(msg_chunk, "content", None)
                has_tool_calls = getattr(msg_chunk, "tool_calls", None) or getattr(msg_chunk, "tool_call_chunks", None)
                if chunk_type in ("ai", "AIMessageChunk") and has_content and not has_tool_calls:
                    token_text = msg_chunk.content if isinstance(msg_chunk.content, str) else ""
                    if token_text:
                        # On first token, transition "Thinking..." to "Responding..."
                        if not seen_first_token and active_step_id == thinking_step_id:
                            seen_first_token = True
                            await _emit_done(thinking_step_id, "Thinking...")
                            responding_id = f"responding-{uuid.uuid4().hex[:8]}"
                            await _emit_running(responding_id, "Composing response...")

                        token_buffer += token_text
                        while token_buffer:
                            if not in_think_block:
                                pos = token_buffer.find("<think>")
                                if pos != -1:
                                    # flush text before <think> normally
                                    if pos > 0:
                                        await bus.emit(session_id, AgentEvent(type="token_delta", data={"token": token_buffer[:pos]}, agent_id="orchestrator"))
                                    in_think_block = True
                                    token_buffer = token_buffer[pos + len("<think>"):]
                                else:
                                    # check partial `<think>` at the end of buffer to avoid flushing
                                    flush_len = len(token_buffer)
                                    for i in range(1, 7):
                                        if token_buffer.endswith("<think>"[:i]):
                                            flush_len = len(token_buffer) - i
                                            break
                                    if flush_len > 0:
                                        await bus.emit(session_id, AgentEvent(type="token_delta", data={"token": token_buffer[:flush_len]}, agent_id="orchestrator"))
                                    token_buffer = token_buffer[flush_len:]
                                    break
                            else:
                                pos = token_buffer.find("</think>")
                                if pos != -1:
                                    if pos > 0:
                                        await bus.emit(session_id, AgentEvent(type="thought_stream", data={"token": token_buffer[:pos]}, agent_id="orchestrator"))
                                    in_think_block = False
                                    token_buffer = token_buffer[pos + len("</think>"):]
                                else:
                                    # check partial `</think>`
                                    flush_len = len(token_buffer)
                                    for i in range(1, 8):
                                        if token_buffer.endswith("</think>"[:i]):
                                            flush_len = len(token_buffer) - i
                                            break
                                    if flush_len > 0:
                                        await bus.emit(session_id, AgentEvent(type="thought_stream", data={"token": token_buffer[:flush_len]}, agent_id="orchestrator"))
                                    token_buffer = token_buffer[flush_len:]
                                    break
                continue

            # ── Node-level updates ──
            event = chunk
            for node_name, node_output in event.items():
                if node_name == "__interrupt__":
                    continue

                # When model node completes, mark the active thinking/responding step done
                if node_name == "model":
                    # Extract tool call info for the decision label
                    tool_names: list[str] = []
                    has_tool_calls = False
                    if isinstance(node_output, dict):
                        for m in node_output.get("messages", []):
                            if hasattr(m, "tool_calls") and m.tool_calls:
                                has_tool_calls = True
                                for tc in m.tool_calls:
                                    tool_names.append(tc.get("name", "unknown"))

                    # Track last AI content for empty-response fallback
                    # Only count content from messages WITHOUT tool calls (final answers)
                    if not has_tool_calls and isinstance(node_output, dict):
                        for m in node_output.get("messages", []):
                            c = getattr(m, "content", None) or (
                                m.get("content") if isinstance(m, dict) else None
                            )
                            if c and isinstance(c, str) and c.strip():
                                last_ai_content = c

                    if active_step_id:
                        # Build a descriptive decision summary for the UI
                        if tool_names:
                            decision = _describe_tool_action(tool_names, node_output)
                        else:
                            decision = "Summarizing findings..."
                        await _emit_done(
                            active_step_id, "Thinking...",
                            detail=decision,
                        )

                    if has_tool_calls:
                        # Tools are about to run — middleware emits tool_start/tool_end
                        tools_step_id = f"tools-{uuid.uuid4().hex[:8]}"
                        await _emit_running(tools_step_id, "Running tools...")

                elif node_name == "tools":
                    # Track tool output for fallback
                    if isinstance(node_output, dict):
                        for m in node_output.get("messages", []):
                            tool_name = getattr(m, "name", None) or (
                                m.get("name") if isinstance(m, dict) else None
                            )
                            # Skip load_skill content (huge skill text, not useful)
                            if tool_name == "load_skill":
                                continue
                            c = getattr(m, "content", None) or (
                                m.get("content") if isinstance(m, dict) else None
                            )
                            if c and isinstance(c, str) and c.strip():
                                # For task tool, only use if it has real content (not empty sub-agent result)
                                if tool_name == "task":
                                    # task results are often stringified objects — skip unless meaningful
                                    if len(c.strip()) > 20 and not c.strip().startswith("Command("):
                                        last_tool_output = c
                                else:
                                    last_tool_output = c

                    # Tools node completed — mark running tools step done
                    if active_step_id:
                        await _emit_done(active_step_id, "Running tools...")

                    # Model will think again — start a new thinking step
                    model_iteration += 1
                    thinking_step_id = f"thinking-{model_iteration}-{uuid.uuid4().hex[:8]}"
                    seen_first_token = False
                    await _emit_running(thinking_step_id, "Thinking...")

                # Skip middleware/internal nodes from progress
                elif node_name in (
                    "PatchToolCallsMiddleware.before_agent",
                    "TodoListMiddleware.after_model",
                ):
                    pass

                # Emit thinking/planning events for transparency
                thinking_events = _extract_thinking(node_name, node_output)
                for thinking in thinking_events:
                    await bus.emit(session_id, AgentEvent(
                        type="thinking", data=thinking, agent_id="orchestrator",
                    ))

                # Check for artifacts in node output
                artifacts = _extract_artifacts(node_output)
                for artifact in artifacts:
                    stored = store.add_artifact(session_id, artifact)
                    emitted_artifact_ids.add(stored.id)
                    artifacts_this_turn.append(stored.title)
                    await bus.emit(session_id, AgentEvent(
                        type="artifact", data=stored.model_dump(), agent_id="orchestrator",
                    ))

                # Check for artifacts saved to store during tool execution
                for artifact in store.get_artifacts(session_id):
                    if artifact.id not in emitted_artifact_ids:
                        emitted_artifact_ids.add(artifact.id)
                        artifacts_this_turn.append(artifact.title)
                        logger.info("artifact: [%s] %s (%s)", artifact.id, artifact.title, artifact.type)
                        await bus.emit(session_id, AgentEvent(
                            type="artifact", data=artifact.model_dump(), agent_id="orchestrator",
                        ))

                # Check for dashboard updates
                for comp in _extract_dashboard(node_output):
                    store.add_dashboard_component(session_id, comp)
                    await bus.emit(session_id, AgentEvent(
                        type="dashboard", data=comp, agent_id="orchestrator",
                    ))

                # Main message update (full content, authoritative)
                serialized = _serialize(node_output)
                await bus.emit(session_id, AgentEvent(
                    type="message",
                    data={"node": node_name, "data": serialized, "session_id": session_id},
                    agent_id="orchestrator",
                ))

        # Flush any remaining buffer text
        if token_buffer:
            if in_think_block:
                await bus.emit(session_id, AgentEvent(type="thought_stream", data={"token": token_buffer}, agent_id="orchestrator"))
            else:
                await bus.emit(session_id, AgentEvent(type="token_delta", data={"token": token_buffer}, agent_id="orchestrator"))

        # Mark any lingering running step as done
        if active_step_id:
            await _emit_done(active_step_id, "Complete")

        # ── Fallback: if model produced empty final response ──
        # Artifacts render inline in the chat, so just provide a brief label
        if not last_ai_content.strip():
            fallback = ""
            if artifacts_this_turn:
                # Artifacts already render inline — just a short note
                if len(artifacts_this_turn) == 1:
                    fallback = f"Here's **{artifacts_this_turn[0]}**:"
                else:
                    titles = ", ".join(f"**{t}**" for t in artifacts_this_turn)
                    fallback = f"Here are the results: {titles}"
            elif last_tool_output.strip():
                output = last_tool_output.strip()
                if output.startswith("Output:\n"):
                    output = output[len("Output:\n"):]
                # Don't dump raw HTML — artifacts handle display
                if "<table" in output or "<html" in output or "artifact-table" in output:
                    fallback = "Here are the results:"
                elif "[Table auto-saved as artifact" in output:
                    fallback = "Here are the results:"
                elif output.startswith("Error:") or output.startswith("SQL Error:"):
                    fallback = "Sorry, I encountered an error while processing your request. Please try rephrasing your question."
                else:
                    fallback = f"Here are the results:\n\n```\n{output[:1500]}\n```"
            # Catch-all: if still no fallback, emit a generic message so the user never sees empty
            if not fallback:
                fallback = "I wasn't able to generate a response for that. Could you try rephrasing your question?"
            if fallback:
                logger.info("Empty model response — emitting fallback")
                await bus.emit(session_id, AgentEvent(
                    type="message",
                    data={
                        "node": "model",
                        "data": {"messages": [{"content": fallback, "type": "ai"}]},
                        "session_id": session_id,
                    },
                    agent_id="orchestrator",
                ))

        # Final done event
        await bus.emit(session_id, AgentEvent(
            type="progress",
            data={"id": "done", "label": "Complete", "status": "done",
                  "started_at": time.time(), "finished_at": time.time()},
            agent_id="orchestrator",
        ))
        await bus.emit(session_id, AgentEvent(
            type="done", data={"session_id": session_id}, agent_id="orchestrator",
        ))

    except Exception as e:
        traceback.print_exc()
        # Mark any running step as error
        if active_step_id:
            await bus.emit(session_id, AgentEvent(
                type="progress",
                data={"id": active_step_id, "label": "Error", "status": "error",
                      "detail": str(e)[:200], "started_at": active_step_start,
                      "finished_at": time.time()},
                agent_id="orchestrator",
            ))
        await bus.emit(session_id, AgentEvent(
            type="error", data={"error": str(e)}, agent_id="orchestrator",
        ))




def _extract_artifacts(output: Any) -> list:
    """Extract artifacts from agent output."""
    from app.artifacts.store import Artifact
    artifacts = []

    if isinstance(output, dict):
        for artifact_data in output.get("artifacts", []):
            if isinstance(artifact_data, dict):
                artifacts.append(Artifact(**artifact_data))
            elif isinstance(artifact_data, Artifact):
                artifacts.append(artifact_data)

    return artifacts


def _extract_dashboard(output: Any) -> list[dict]:
    """Extract dashboard components from agent output."""
    if isinstance(output, dict):
        return output.get("dashboard_components", [])
    return []


def _describe_tool_action(tool_names: list[str], node_output: Any) -> str:
    """Generate a user-friendly description of what tools are about to run."""
    descriptions = {
        "query_duckdb": "Querying database",
        "run_python": "Running Python code",
        "save_artifact": "Saving artifact",
        "save_dashboard_component": "Building dashboard",
        "list_datasets": "Listing available data",
        "get_schema": "Inspecting table schema",
        "load_skill": "Loading skill instructions",
        "get_artifact_content": "Reading artifact",
        "update_artifact": "Updating artifact",
        "write_todos": "Planning steps",
        "task": "Delegating to sub-agent",
    }

    parts = []
    for name in tool_names:
        desc = descriptions.get(name, name)
        parts.append(desc)

    # Try to add detail from first tool call args
    if isinstance(node_output, dict):
        for m in node_output.get("messages", []):
            if hasattr(m, "tool_calls") and m.tool_calls:
                tc = m.tool_calls[0]
                args = tc.get("args", {})
                tool_name = tc.get("name", "")
                if tool_name == "query_duckdb" and "sql" in args:
                    sql_preview = args["sql"][:60].replace("\n", " ")
                    return f"Querying database: {sql_preview}..."
                elif tool_name == "run_python" and "code" in args:
                    first_line = args["code"].split("\n")[0][:50]
                    return f"Running Python: {first_line}..."
                elif tool_name == "get_schema" and "table_name" in args:
                    return f"Inspecting schema: {args['table_name']}"
                elif tool_name == "load_skill" and "skill_name" in args:
                    return f"Loading skill: {args['skill_name']}"
                break

    return " → ".join(parts)


def _extract_thinking(node_name: str, output: Any) -> list[dict]:
    """Extract thinking/planning events from node output for A2UI transparency.

    Emits two kinds of todo-related events:
    - kind=plan: initial plan from write_todos (model node)
    - kind=todo_update: updated todo statuses (tools node, from TodoListMiddleware)
    """
    events: list[dict] = []

    if not isinstance(output, dict):
        return events

    # ── From tools node: extract updated todo list with statuses ──
    # The TodoListMiddleware stores the canonical todo list in the tools node output
    if node_name == "tools":
        todos_data = output.get("todos", [])
        if isinstance(todos_data, list) and todos_data:
            todo_items = []
            for t in todos_data:
                if isinstance(t, dict):
                    text = t.get("content", str(t))
                    status = t.get("status", "pending")
                    # Normalize deepagents status to our frontend convention
                    if status == "in_progress":
                        status = "running"
                    elif status in ("done", "completed"):
                        status = "done"
                    else:
                        status = "pending"
                    todo_items.append({"text": text, "status": status})
                else:
                    todo_items.append({"text": str(t), "status": "pending"})
            if todo_items:
                events.append({
                    "kind": "todo_update",
                    "label": "Plan progress",
                    "todoItems": todo_items,
                })

    # ── From model node: extract initial plan and delegations ──
    if node_name not in ("model", "executor"):
        return events

    msgs = output.get("messages", [])
    for m in msgs:
        if not hasattr(m, "tool_calls") or not m.tool_calls:
            continue
        for tc in m.tool_calls:
            tool_name = tc.get("name", "")
            args = tc.get("args", {})

            if tool_name == "write_todos":
                # Planning — extract todo items as structured objects
                todos = args.get("todos", [])
                if isinstance(todos, list) and todos:
                    todo_items = []
                    for t in todos:
                        if isinstance(t, dict):
                            text = t.get("content", str(t))
                            status = t.get("status", "pending")
                            if status == "in_progress":
                                status = "running"
                            elif status in ("done", "completed"):
                                status = "done"
                            else:
                                status = "pending"
                            todo_items.append({"text": text, "status": status})
                        else:
                            todo_items.append({"text": str(t), "status": "pending"})
                    events.append({
                        "kind": "plan",
                        "label": "Planning analysis steps",
                        "todoItems": todo_items,
                        # Keep items for backward compat
                        "items": [ti["text"] for ti in todo_items],
                    })

            elif tool_name == "task":
                # Sub-agent delegation
                agent_name = args.get("agent", args.get("name", ""))
                description = args.get("description", args.get("task", ""))
                if agent_name:
                    events.append({
                        "kind": "delegation",
                        "label": f"Delegating to {agent_name}",
                        "agent": agent_name,
                        "task": description[:200] if description else "",
                    })

    return events


def _save_trace(
    session_id: str, question: str, events: list[dict], start_time: float
) -> None:
    """Save a trace file for this Q&A exchange."""
    try:
        traces_dir = Path("traces") / session_id
        traces_dir.mkdir(parents=True, exist_ok=True)

        ts = datetime.fromtimestamp(start_time, tz=timezone.utc)
        filename = ts.strftime("%Y%m%d_%H%M%S") + f"_{uuid.uuid4().hex[:6]}.json"

        # Extract the assistant response from message events
        response = ""
        for evt in events:
            if evt["event_type"] == "message" and isinstance(evt["data"], dict):
                data = evt["data"].get("data")
                if isinstance(data, dict):
                    msgs = data.get("messages", [])
                    for m in msgs:
                        if isinstance(m, dict) and m.get("type") in ("ai", "AIMessage"):
                            content = m.get("content", "")
                            if content and isinstance(content, str):
                                response = content

        trace = {
            "session_id": session_id,
            "timestamp": ts.isoformat(),
            "question": question,
            "response": response[:2000],  # Truncate for readability
            "total_elapsed_s": round(time.time() - start_time, 3),
            "event_count": len(events),
            "events": events,
        }

        trace_path = traces_dir / filename
        trace_path.write_text(json.dumps(trace, indent=2, default=str))
        logger.info("Trace saved: %s", trace_path)
    except Exception as e:
        logger.warning("Failed to save trace: %s", e)


def _serialize(obj: Any) -> Any:
    """Make agent output JSON-serializable.

    Handles LangChain messages, Pydantic models, LangGraph Overwrite wrappers,
    and any other non-serializable types from the deep agent.
    """
    from langchain_core.messages import BaseMessage

    # Unwrap LangGraph Overwrite/Send wrappers
    if hasattr(obj, "value"):
        return _serialize(obj.value)

    if isinstance(obj, BaseMessage):
        result: dict[str, Any] = {
            "content": obj.content,
            "type": getattr(obj, "type", "unknown"),
        }
        if hasattr(obj, "tool_calls") and obj.tool_calls:
            result["tool_calls"] = [
                {"name": tc.get("name", ""), "args": tc.get("args", {})}
                for tc in obj.tool_calls
            ]
        return result
    if hasattr(obj, "model_dump"):
        try:
            return obj.model_dump()
        except Exception:
            return str(obj)
    if isinstance(obj, dict):
        return {k: _serialize(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_serialize(i) for i in obj]
    # Final fallback — make sure we never return non-serializable objects
    try:
        json.dumps(obj)
        return obj
    except (TypeError, ValueError):
        return str(obj)
