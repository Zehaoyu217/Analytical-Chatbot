from __future__ import annotations

import logging
import time
from pathlib import Path
from typing import Any

from langchain_core.messages import SystemMessage, ToolMessage
from langchain_core.runnables import RunnableConfig

logger = logging.getLogger(__name__)

from langchain_core.messages import HumanMessage

from app.agent.context import current_session_id, current_event_bus, current_model_config
from app.agent.state import AgentState
from app.agent.tools.list_datasets import list_datasets
from app.agent.tools.get_schema import get_schema
from app.agent.tools.query_duckdb import query_duckdb
from app.agent.tools.run_python import run_python
from app.agent.tools.load_skill import load_skill
from app.agent.tools.save_artifact import save_artifact, update_artifact, get_artifact_content, save_dashboard_component
from app.agent.tools.delegate import delegate_to_agent
from app.data.catalog import get_catalog
from app.data.duckdb_manager import get_duckdb
from app.events.bus import AgentEvent
from app.llm.provider import get_chat_model


TOOLS = [
    list_datasets, get_schema, query_duckdb, run_python, load_skill,
    save_artifact, update_artifact, get_artifact_content, save_dashboard_component,
    delegate_to_agent,
]

TOOL_MAP = {t.name: t for t in TOOLS}

SYSTEM_PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "system_prompt.md"



def _get_data_context() -> str:
    """Pre-fetch dataset schemas and sample rows.

    Provides just enough context for the LLM to write correct queries:
    - Table names and row counts
    - Column names, types
    - First 5 rows as a sample (like df.head())

    The LLM must still query/compute on the actual data via tools —
    this prevents hallucination while keeping the prompt small.
    """
    try:
        catalog = get_catalog()
        datasets = catalog.list_datasets()
        if not datasets:
            return "\n\n## Available Data\nNo datasets uploaded yet."
        db = get_duckdb()
        lines = ["\n\n## Available Data"]
        lines.append("**IMPORTANT**: The sample rows below are for understanding the data structure only. "
                      "Always use `query_duckdb` or `run_python` to compute actual results — never "
                      "guess values from these samples.")
        for ds in datasets:
            tname = ds["table_name"]
            lines.append(f"\n### Table: `{tname}` ({ds['row_count']} rows)")
            schema = db.get_table_schema(tname)
            cols = [f"  - `{c['name']}`: {c['type']}" for c in schema]
            lines.append("Columns:\n" + "\n".join(cols))
            # Add sample rows (head 5) so LLM understands the data shape
            try:
                sample = db.execute_query_raw(f'SELECT * FROM "{tname}" LIMIT 5')
                if sample["rows"]:
                    lines.append(f"\nSample ({min(5, len(sample['rows']))} rows):")
                    header = " | ".join(sample["columns"])
                    lines.append(f"  {header}")
                    lines.append(f"  {'-' * len(header)}")
                    for row in sample["rows"][:5]:
                        lines.append(f"  {' | '.join(str(v) for v in row)}")
            except Exception:
                pass
        return "\n".join(lines)
    except Exception:
        return ""


def _get_system_prompt(
    skill_content: str | None = None,
) -> str:
    """Build the system prompt with data context and optional skill instructions.

    Data context (dataset names + schemas) is ALWAYS included to eliminate
    the need for list_datasets/get_schema tool calls, reducing LLM roundtrips.
    """
    base = SYSTEM_PROMPT_PATH.read_text() if SYSTEM_PROMPT_PATH.exists() else (
        "You are an analytical chatbot that helps users explore and analyze data. "
        "You have access to tools for querying databases, running Python code, and creating visualizations."
    )

    # Inject skill catalog so the agent knows what skills are available
    from app.skills.registry import get_skill_registry
    try:
        registry = get_skill_registry()
        catalog = registry.get_catalog_prompt()
        if catalog:
            base += "\n" + catalog
    except Exception:
        pass

    # Always include data context so the LLM can query directly without
    # needing to call list_datasets/get_schema first (saves 2+ LLM roundtrips)
    base += _get_data_context()
    if skill_content:
        base += f"\n\n## Active Skill Instructions\n{skill_content}"
    return base






def _preview_args(tool_name: str, args: dict) -> str:
    """Create a short preview of tool args for progress display."""
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


async def _run_tool(name: str, args: dict) -> str:
    """Execute a tool by name and return the result as a string."""
    tool_fn = TOOL_MAP.get(name)
    if not tool_fn:
        return f"Unknown tool: {name}"
    try:
        logger.info("tool: calling %s with args keys=%s", name, list(args.keys()))
        result = await tool_fn.ainvoke(args)
        result_str = str(result)
        logger.info("tool: %s returned %d chars", name, len(result_str))
        return result_str
    except Exception as e:
        logger.error("tool: %s error: %s", name, e)
        return f"Tool error: {e}"


async def _emit_event(event: AgentEvent) -> None:
    """Emit an A2UI event if EventBus is available."""
    bus = current_event_bus.get()
    if bus:
        session_id = current_session_id.get()
        await bus.emit(session_id, event)


async def _execute_with_tools(
    llm: Any, messages: list, tool_log: list, max_iterations: int = 10,
) -> Any:
    """Execute using native tool calling (for models that support it)."""
    llm_with_tools = llm.bind_tools(TOOLS)
    response = None

    for iteration in range(max_iterations):
        response = await llm_with_tools.ainvoke(messages)
        messages.append(response)

        if not response.tool_calls:
            break

        for tool_call in response.tool_calls:
            tool_name = tool_call["name"]
            tool_args = tool_call["args"]
            args_preview = _preview_args(tool_name, tool_args)

            # A2UI: emit tool_start
            await _emit_event(AgentEvent(
                type="tool_start",
                data={"tool": tool_name, "args_preview": args_preview},
                agent_id="orchestrator",
            ))

            t0 = time.monotonic()
            result = await _run_tool(tool_name, tool_args)
            elapsed = time.monotonic() - t0

            # A2UI: emit tool_end
            await _emit_event(AgentEvent(
                type="tool_end",
                data={
                    "tool": tool_name,
                    "elapsed_s": round(elapsed, 2),
                    "result_preview": result[:200] if result else "",
                },
                agent_id="orchestrator",
            ))

            # Log tool call for progress visibility
            tool_log.append({
                "tool": tool_name,
                "args_preview": args_preview,
                "result_preview": result[:200] if result else "",
                "elapsed_s": round(elapsed, 2),
                "iteration": iteration + 1,
            })
            messages.append(ToolMessage(
                content=result,
                tool_call_id=tool_call["id"],
            ))

    return response



async def executor_node(state: AgentState, config: RunnableConfig) -> dict[str, Any]:
    """Execute the agent's response, using tools as needed following skill instructions."""
    configurable = config.get("configurable", {})
    model_name = configurable.get("model")
    provider_name = configurable.get("provider")
    session_id = configurable.get("session_id", "default")

    # Set session context so tools (save_artifact, run_python) can access it
    token = current_session_id.set(session_id)
    token_model = current_model_config.set({"model": model_name, "provider": provider_name})

    try:
        kwargs = {}
        if model_name:
            kwargs["model"] = model_name
        if provider_name:
            kwargs["provider"] = provider_name
        llm = get_chat_model(**kwargs)

        logger.info(
            "executor: model=%s provider=%s",
            model_name, provider_name,
        )
        system_prompt = _get_system_prompt(state.skill_content)
        messages = [SystemMessage(content=system_prompt)] + list(state.messages)

        tool_log: list[dict[str, Any]] = []

        t0 = time.monotonic()
        response = await _execute_with_tools(
            llm, messages, tool_log, max_iterations=10,
        )
        logger.info("executor: LLM responded in %.1fs, %d tool calls", time.monotonic() - t0, len(tool_log))

        return {"messages": [response], "tool_calls_log": tool_log}
    finally:
        current_session_id.reset(token)
        current_model_config.reset(token_model)
