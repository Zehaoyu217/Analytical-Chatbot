"""Deep Agent factory — wraps LangChain's deepagents SDK for the analytical chatbot.

Supports two modes (configurable via config.yaml `agent.mode`):

- **single**: One agent with all tools + skills. No sub-agent delegation.
  Faster for small models, avoids context isolation issues.
- **multi**: Orchestrator + 4 specialized sub-agents (data_profiler, sql_analyst,
  visualizer, researcher). Better for large models that can plan + delegate.
"""
from __future__ import annotations

import difflib
import logging
import re
import time
from pathlib import Path
from typing import Any

from deepagents import create_deep_agent, SubAgent
from langchain.agents.middleware.types import AgentMiddleware
from langchain_core.messages import AIMessage, ToolMessage
from langchain_core.tools import BaseTool
from langgraph.graph.state import CompiledStateGraph

from app.agent.context import current_event_bus, current_session_id
from app.agent.tools.list_datasets import list_datasets
from app.agent.tools.get_schema import get_schema
from app.agent.tools.query_duckdb import query_duckdb
from app.agent.tools.run_python import run_python
from app.agent.tools.load_skill import load_skill
from app.agent.tools.save_artifact import (
    save_artifact, update_artifact, get_artifact_content, save_dashboard_component,
)
from app.agent.tools.show_component import show_component
from app.agent.tools.record_finding import record_finding
from app.agent.tools.read_result import read_result
from app.agent.persistent_state import PersistentStateMiddleware, _persistent_store
from app.data.catalog import get_catalog
from app.data.duckdb_manager import get_duckdb
from app.events.bus import AgentEvent
from app.llm.provider import get_chat_model

logger = logging.getLogger(__name__)

SYSTEM_PROMPT_PATH = Path(__file__).parent / "prompts" / "system_prompt.md"
PROMPTS_DIR = Path(__file__).parent / "prompts"

# All tools available to the agent (both modes)
AGENT_TOOLS: list[BaseTool] = [
    list_datasets, get_schema, query_duckdb, run_python, load_skill,
    save_artifact, update_artifact, get_artifact_content, save_dashboard_component,
    show_component, record_finding, read_result,
]


def _load_prompt(filename: str) -> str:
    path = PROMPTS_DIR / filename
    if path.exists():
        return path.read_text()
    logger.warning("Prompt not found: %s", path)
    return "You are a helpful data analysis assistant."


def _get_data_context(relevant_datasets: list[str] | None = None) -> str:
    """Pre-fetch dataset schemas and sample rows for the system prompt."""
    try:
        catalog = get_catalog()
        datasets = catalog.list_datasets()
        if not datasets:
            return "\n\n## Available Data\nNo datasets uploaded yet."
            
        if relevant_datasets is not None:
            datasets = [ds for ds in datasets if ds["table_name"] in relevant_datasets]
            
        db = get_duckdb()
        lines = ["\n\n## Available Data"]
        lines.append(
            "**IMPORTANT**: The sample rows below are for understanding the data structure only. "
            "Always use `query_duckdb` or `run_python` to compute actual results — never "
            "guess values from these samples."
        )
        for ds in datasets:
            tname = ds["table_name"]
            lines.append(f"\n### Table: `{tname}` ({ds['row_count']} rows)")
            schema = db.get_table_schema(tname)
            cols = [f"  - `{c['name']}`: {c['type']}" for c in schema]
            lines.append("Columns:\n" + "\n".join(cols))
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


def _build_system_prompt(mode: str = "single", relevant_datasets: list[str] | None = None) -> str:
    """Build the full system prompt with skill catalog and data context.

    In single mode, strips delegation instructions.
    In multi mode, keeps them.
    """
    base = SYSTEM_PROMPT_PATH.read_text() if SYSTEM_PROMPT_PATH.exists() else (
        "You are an analytical chatbot that helps users explore and analyze data."
    )

    if mode == "single":
        # Remove the delegation section — single agent handles everything directly
        lines = base.split("\n")
        filtered = []
        skip = False
        for line in lines:
            if line.strip().startswith("## Agent Delegation"):
                skip = True
                continue
            if skip and line.strip().startswith("## "):
                skip = False
            if not skip:
                filtered.append(line)
        base = "\n".join(filtered)

    # Inject skill catalog so the agent knows what skills are available
    from app.skills.registry import get_skill_registry
    try:
        registry = get_skill_registry()
        catalog = registry.get_catalog_prompt()
        if catalog:
            base += "\n" + catalog
    except Exception:
        pass

    base += _get_data_context(relevant_datasets)
    return base


# ── Middleware ──────────────────────────────────────────────────────


_OFFLOAD_THRESHOLD = 1500  # chars — results larger than this go to disk
# Tools whose results should NOT be offloaded (they're already compact references or UI events)
_OFFLOAD_SKIP_TOOLS = frozenset({
    "write_todos", "record_finding", "load_skill", "list_datasets",
    "save_artifact", "save_dashboard_component", "show_component", "read_result",
})


def _maybe_offload_result(result: Any, result_text: str, tool_name: str, session_id: str | None) -> Any:
    """If result is large, write to disk and return a compact reference ToolMessage."""
    if tool_name in _OFFLOAD_SKIP_TOOLS:
        return result
    if not session_id or len(result_text) <= _OFFLOAD_THRESHOLD:
        return result

    try:
        from pathlib import Path as _Path
        import time as _time

        session_dir = _Path(f"/tmp/agent_results/{session_id}")
        session_dir.mkdir(parents=True, exist_ok=True)
        fname = f"{tool_name}_{int(_time.time() * 1000)}.txt"
        fpath = session_dir / fname
        fpath.write_text(result_text, encoding="utf-8")

        lines = result_text.split("\n")
        preview = "\n".join(lines[:5])
        compact = (
            f"[Result archived — {len(result_text):,} chars, {len(lines)} lines → {fpath}]\n"
            f"Preview (first 20 lines):\n{preview}\n"
            f"[Use read_result('{fpath}') to load full content if needed]"
        )
        return ToolMessage(
            content=compact,
            tool_call_id=result.tool_call_id,
            name=getattr(result, "name", None),
        )
    except Exception:
        return result  # Never fail — return original on any error


async def _validate_plan(plan_text: str) -> list[str]:
    """Check plan text for column/table references that don't exist in the live schema."""
    try:
        catalog = get_catalog()
        db = get_duckdb()
        all_tables = {ds["table_name"] for ds in catalog.list_datasets()}
        if not all_tables:
            return []

        all_columns: list[str] = []
        table_columns: dict[str, list[str]] = {}
        for tname in all_tables:
            schema = db.get_table_schema(tname)
            cols = [c["name"].lower() for c in schema]
            all_columns.extend(cols)
            table_columns[tname] = cols

        # Find backtick-quoted identifiers in the plan
        col_refs = re.findall(r"`([a-zA-Z_][a-zA-Z0-9_]*)`", plan_text)
        warnings: list[str] = []
        seen: set[str] = set()
        for ref in col_refs:
            ref_lower = ref.lower()
            if ref_lower in seen:
                continue
            seen.add(ref_lower)
            # Skip common Python/SQL keywords
            if ref_lower in {"df", "sql", "select", "from", "where", "group", "order", "limit",
                             "by", "and", "or", "not", "as", "join", "on", "true", "false"}:
                continue
            if any(ref_lower in cols for cols in table_columns.values()):
                continue  # found in a table — OK
            close = difflib.get_close_matches(ref_lower, all_columns, n=2, cutoff=0.7)
            warnings.append(
                f"  Column `{ref}` not found in any table."
                + (f" Did you mean: {close}?" if close else " Run get_schema() to verify.")
            )
        return warnings
    except Exception:
        return []  # Never block plan execution due to validation errors


class EventBusMiddleware(AgentMiddleware):
    """Emits tool_start/tool_end events to our EventBus for real-time UI."""

    async def awrap_tool_call(self, request, handler):
        tc = request.tool_call
        tool_name = tc.get("name", "") if isinstance(tc, dict) else getattr(tc, "name", "")

        # Native deepagents SDK handles write_todos with its own 'thinking' layout event.
        # We run plan validation here and optionally append schema warnings.
        if tool_name == "write_todos":
            result = await handler(request)
            warnings = await _validate_plan(
                result.content if hasattr(result, "content") else str(result)
            )
            if warnings:
                result_text = result.content if hasattr(result, "content") else str(result)
                result = ToolMessage(
                    content=result_text + "\n\n[PLAN VALIDATOR — schema warnings]:\n" + "\n".join(warnings),
                    tool_call_id=result.tool_call_id,
                )
            return result

        args = tc.get("args", {}) if isinstance(tc, dict) else getattr(tc, "args", {})
        args_preview = _preview_args(tool_name, args)

        bus = current_event_bus.get()
        session_id = current_session_id.get()

        if bus:
            await bus.emit(session_id, AgentEvent(
                type="tool_start",
                data={"tool": tool_name, "args_preview": args_preview},
                agent_id="orchestrator",
            ))

        t0 = time.monotonic()
        result = await handler(request)
        elapsed = round(time.monotonic() - t0, 2)

        result_text = result.content if hasattr(result, "content") else str(result)

        # C1: Offload large results to disk — keep message history lean
        result = _maybe_offload_result(result, result_text, tool_name, session_id)
        result_text = result.content if hasattr(result, "content") else str(result)

        if bus:
            await bus.emit(session_id, AgentEvent(
                type="tool_end",
                data={
                    "tool": tool_name,
                    "elapsed_s": elapsed,
                    "result_preview": (result_text[:200] if result_text else ""),
                },
                agent_id="orchestrator",
            ))

            # Intercept sub-agent raw responses and stream polished versions in parallel
            is_subagent = False
            subagent_name = ""
            if tool_name == "task" and isinstance(args, dict) and "agent_name" in args:
                is_subagent = True
                subagent_name = args["agent_name"]

            if is_subagent:
                if result_text and len(result_text) > 20:
                    import asyncio
                    from app.llm.polisher import stream_polished_subagent
                    
                    # Fire-and-forget background task so Orchestrator is unblocked
                    asyncio.create_task(stream_polished_subagent(
                        raw_text=result_text,
                        session_id=session_id,
                        bus=bus,
                        agent_name=subagent_name
                    ))

        return result


class ToolResultCompactionMiddleware(AgentMiddleware):
    """Compacts old tool results to save context window space.

    Keeps the latest `max_keep` tool results in full. Older tool results
    are truncated to a one-line summary. This prevents long sessions from
    blowing the context window while preserving recent results the agent
    needs to reason about.
    """

    def __init__(self, max_keep: int = 10):
        self.max_keep = max_keep

    def before_agent(self, state, runtime):
        messages = state.get("messages", [])
        if not messages:
            return None

        # Count tool messages from the end
        tool_indices = [
            i for i, m in enumerate(messages)
            if isinstance(m, ToolMessage)
        ]

        if len(tool_indices) <= self.max_keep:
            return None  # Nothing to compact

        # Indices of tool messages to compact (older ones)
        to_compact = tool_indices[:-self.max_keep]

        compacted = list(messages)
        for idx in to_compact:
            msg = compacted[idx]
            content = msg.content if isinstance(msg.content, str) else str(msg.content)
            if len(content) > 200:
                # Preserve first line (usually the key result) and note it was compacted
                first_line = content.split("\n")[0][:150]
                compacted[idx] = ToolMessage(
                    content=f"{first_line}... [compacted — {len(content)} chars]",
                    tool_call_id=msg.tool_call_id,
                    name=getattr(msg, "name", None),
                )

        from langgraph.types import Overwrite
        return {"messages": Overwrite(compacted)}



def _preview_args(tool_name: str, args: dict) -> str:
    """Create a short preview of tool args for progress display."""
    if tool_name == "query_duckdb":
        sql = args.get("sql", "")
        return f"SQL: {sql[:80]}..." if len(sql) > 80 else f"SQL: {sql}"
    if tool_name == "run_python":
        return args.get("code", "")
    if tool_name == "get_schema":
        return f"Table: {args.get('table_name', '')}"
    if tool_name == "load_skill":
        return f"Skill: {args.get('skill_name', '')}"
    if tool_name == "save_artifact":
        return args.get("title", "")[:50]
    return str(args)[:80]


# ── Sub-agents (multi mode only) ────────────────────────────────────


def _build_subagents(relevant_datasets: list[str] | None = None) -> list[SubAgent]:
    """Build sub-agent definitions for deepagents' task tool (multi mode only).

    Two focused sub-agents:
    - analyst: all data analysis, profiling, SQL, research
    - visualizer: charts and plots using Altair with GS theme
    """
    data_context = _get_data_context(relevant_datasets)
    return [
        SubAgent(
            name="analyst",
            description="Data profiling, SQL analysis, statistical research, multi-step investigations, and reporting",
            system_prompt=_load_prompt("analyst_prompt.md") + data_context,
            tools=[
                list_datasets, get_schema, query_duckdb, run_python,
                load_skill, save_artifact, save_dashboard_component,
                record_finding, read_result,
            ],
        ),
        SubAgent(
            name="visualizer",
            description="Charts, plots, and visual data representations using Altair/Vega-Lite with GS theme",
            system_prompt=_load_prompt("visualizer_prompt.md") + data_context,
            tools=[
                list_datasets, get_schema, query_duckdb, run_python,
                load_skill, save_artifact, save_dashboard_component,
                record_finding, read_result,
            ],
        ),
    ]


# ── Agent builder ────────────────────────────────────────────────────


def build_deep_agent(
    model: str | None = None,
    provider: str | None = None,
    mode: str | None = None,
    relevant_datasets: list[str] | None = None,
) -> CompiledStateGraph:
    """Build the deep agent.

    Args:
        model: LLM model name.
        provider: LLM provider name.
        mode: "single" (one agent + skills) or "multi" (orchestrator + sub-agents).
              Defaults to config value.
    """
    from app.config import get_config
    cfg = get_config()
    mode = mode or cfg.agent.mode
    max_keep = cfg.agent.max_tool_results_kept

    kwargs: dict[str, Any] = {}
    if model:
        kwargs["model"] = model
    if provider:
        kwargs["provider"] = provider
    llm = get_chat_model(**kwargs)

    system_prompt = _build_system_prompt(mode=mode)

    from langgraph.checkpoint.memory import MemorySaver
    checkpointer = MemorySaver()
    # NOTE: H6 (SQLite checkpoint persistence) deferred — AsyncSqliteSaver requires
    # async context manager lifecycle management (app lifespan) not available in this
    # sync factory. MemorySaver works correctly; sessions reset on server restart.

    middleware = [
        PersistentStateMiddleware(_persistent_store),
        ToolResultCompactionMiddleware(max_keep=max_keep),
        EventBusMiddleware(),
    ]

    if mode == "multi":
        # Orchestrator doesn't need load_skill — sub-agents handle specialized tasks
        orchestrator_tools = [t for t in AGENT_TOOLS if t.name != "load_skill"]
        subagents = _build_subagents()
        agent = create_deep_agent(
            model=llm,
            tools=orchestrator_tools,
            system_prompt=system_prompt,
            subagents=subagents,
            middleware=middleware,
            checkpointer=checkpointer,
            name="analytical_agent",
        )
        logger.info(
            "Deep agent built (MULTI mode): model=%s, %d tools, %d subagents",
            model or "default", len(AGENT_TOOLS), len(subagents),
        )
    else:
        # Single mode — no sub-agents, all tools directly available
        agent = create_deep_agent(
            model=llm,
            tools=AGENT_TOOLS,
            system_prompt=system_prompt,
            subagents=[],
            middleware=middleware,
            checkpointer=checkpointer,
            name="analytical_agent",
        )
        logger.info(
            "Deep agent built (SINGLE mode): model=%s, %d tools",
            model or "default", len(AGENT_TOOLS),
        )

    return agent


# ── Cache ────────────────────────────────────────────────────────────

_agent_cache: dict[str, CompiledStateGraph] = {}


def get_deep_agent(model: str | None = None, provider: str | None = None, relevant_datasets: list[str] | None = None) -> CompiledStateGraph:
    """Get (or create) a deep agent for the given model/provider combo."""
    from app.config import get_config
    cfg = get_config()
    model = model or cfg.llm.model
    provider = provider or cfg.llm.provider
    mode = cfg.agent.mode
    
    # We must include relevant_datasets in the cache key so it rebuilds if schemas change
    datasets_str = "|".join(sorted(relevant_datasets)) if relevant_datasets else "ALL"
    cache_key = f"{provider}:{model}:{mode}:{datasets_str}"

    if cache_key not in _agent_cache:
        _agent_cache[cache_key] = build_deep_agent(model=model, provider=provider, mode=mode, relevant_datasets=relevant_datasets)
    return _agent_cache[cache_key]


def invalidate_agent_cache() -> None:
    """Clear all cached agents (e.g., after data upload so data context refreshes)."""
    global _agent_cache
    _agent_cache.clear()
