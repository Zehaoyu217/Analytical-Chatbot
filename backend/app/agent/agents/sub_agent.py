from __future__ import annotations

import logging
import time
import uuid
from typing import Any

from langchain_core.messages import SystemMessage, HumanMessage, AIMessage, ToolMessage

from app.agent.agents.registry import AgentCard
from app.agent.context import current_event_bus, current_session_id
from app.events.bus import AgentEvent
from app.llm.provider import get_chat_model

logger = logging.getLogger(__name__)


async def _emit(session_id: str, event: AgentEvent) -> None:
    """Emit an event to the EventBus if available."""
    bus = current_event_bus.get()
    if bus:
        await bus.emit(session_id, event)


async def run_sub_agent(
    card: AgentCard,
    task: str,
    session_id: str,
    model: str | None = None,
    provider: str | None = None,
    max_iterations: int = 8,
) -> str:
    """Execute a sub-agent: build LLM + messages, run tool loop, emit A2UI events, return result.

    Sub-agents are lightweight async functions (not LangGraph subgraphs).
    They reuse the same LLM provider and tool infrastructure as the orchestrator.
    """
    agent_id = f"{card.name}_{uuid.uuid4().hex[:6]}"
    tool_map = {t.name: t for t in card.tools}

    # --- Emit: agent started (A2A Task → WORKING) ---
    await _emit(session_id, AgentEvent(
        type="agent_status",
        data={"agent_name": card.name, "status": "started", "task": task},
        agent_id=agent_id,
        parent_agent_id="orchestrator",
    ))

    try:
        # Build system prompt with data context
        from app.agent.nodes.executor import _get_data_context
        system_prompt = card.system_prompt + _get_data_context()

        # Create LLM
        kwargs: dict[str, Any] = {}
        if model:
            kwargs["model"] = model
        if provider:
            kwargs["provider"] = provider
        llm = get_chat_model(**kwargs)

        # Bind tools if available
        if card.tools:
            llm_with_tools = llm.bind_tools(card.tools)
        else:
            llm_with_tools = llm

        messages: list = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=task),
        ]

        response: AIMessage | None = None
        tool_count = 0
        t_start = time.monotonic()

        for iteration in range(max_iterations):
            response = await llm_with_tools.ainvoke(messages)
            messages.append(response)

            if not hasattr(response, "tool_calls") or not response.tool_calls:
                break

            for tc in response.tool_calls:
                tool_name = tc["name"]
                tool_args = tc["args"]
                tool_fn = tool_map.get(tool_name)

                # --- Emit: tool_start ---
                args_preview = _preview_args(tool_name, tool_args)
                await _emit(session_id, AgentEvent(
                    type="tool_start",
                    data={"tool": tool_name, "args_preview": args_preview},
                    agent_id=agent_id,
                    parent_agent_id="orchestrator",
                ))

                t0 = time.monotonic()
                if tool_fn:
                    try:
                        result = str(await tool_fn.ainvoke(tool_args))
                    except Exception as e:
                        result = f"Tool error: {e}"
                else:
                    result = f"Unknown tool: {tool_name}"
                elapsed = round(time.monotonic() - t0, 2)
                tool_count += 1

                # --- Emit: tool_end ---
                await _emit(session_id, AgentEvent(
                    type="tool_end",
                    data={
                        "tool": tool_name,
                        "elapsed_s": elapsed,
                        "result_preview": result[:200],
                    },
                    agent_id=agent_id,
                    parent_agent_id="orchestrator",
                ))

                messages.append(ToolMessage(
                    content=result,
                    tool_call_id=tc["id"],
                ))

        total_time = round(time.monotonic() - t_start, 2)
        result_text = response.content if response else "Sub-agent completed with no output."

        # --- Emit: agent completed (A2A Task → COMPLETED) ---
        await _emit(session_id, AgentEvent(
            type="agent_status",
            data={
                "agent_name": card.name,
                "status": "completed",
                "tool_calls": tool_count,
                "elapsed_s": total_time,
            },
            agent_id=agent_id,
            parent_agent_id="orchestrator",
        ))

        logger.info(
            "sub_agent: %s completed in %.1fs with %d tool calls",
            card.name, total_time, tool_count,
        )
        return result_text

    except Exception as e:
        logger.error("sub_agent: %s failed: %s", card.name, e)
        # --- Emit: agent failed ---
        await _emit(session_id, AgentEvent(
            type="agent_status",
            data={"agent_name": card.name, "status": "failed", "error": str(e)},
            agent_id=agent_id,
            parent_agent_id="orchestrator",
        ))
        return f"Sub-agent '{card.name}' failed: {e}"


def _preview_args(tool_name: str, args: dict) -> str:
    """Short preview of tool args for progress display."""
    if tool_name == "query_duckdb":
        sql = args.get("sql", "")
        return f"SQL: {sql[:80]}..." if len(sql) > 80 else f"SQL: {sql}"
    if tool_name == "run_python":
        code = args.get("code", "")
        first_line = code.split("\n")[0] if code else ""
        return f"Code: {first_line[:60]}..." if len(first_line) > 60 else f"Code: {first_line}"
    if tool_name == "get_schema":
        return f"Table: {args.get('table_name', '')}"
    return str(args)[:80]
