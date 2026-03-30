"""Persistent agent state — survives tool result compaction across long sessions.

Stores structured agent state in a SQLite side-channel keyed by session_id.
Injected at the top of every agent turn as a compact SystemMessage so the agent
always knows: schema, plan phases, key findings, Python namespace, artifacts, resolved errors.

This is completely separate from LangGraph's checkpoint DB — it tracks semantically
structured state, not raw message history.
"""
from __future__ import annotations

import json
import logging
import re
import sqlite3
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

from langchain.agents.middleware.types import AgentMiddleware
from langchain_core.messages import SystemMessage, ToolMessage

from app.agent.context import current_session_id

logger = logging.getLogger(__name__)


@dataclass
class AgentPersistentState:
    """Structured state that lives outside LangGraph message history."""

    schema: dict[str, list[str]] = field(default_factory=dict)
    # {"table_name": ["col1:TYPE", "col2:TYPE", ...]}

    plan_phases: list[dict[str, Any]] = field(default_factory=list)
    # [{"name": "EDA", "status": "done|in_progress|pending", "steps": [...], "findings": [...]}]

    findings: list[str] = field(default_factory=list)
    # Running list of key discoveries the agent explicitly recorded via record_finding()

    python_namespace: list[str] = field(default_factory=list)
    # ["df_clean (1247 rows, macro data preprocessed)", "_persist_model_ridge (fitted RidgeCV)"]

    artifacts: list[dict[str, str]] = field(default_factory=list)
    # [{"id": "a1", "title": "GDP over Time", "type": "chart"}]

    errors_resolved: list[dict[str, str]] = field(default_factory=list)
    # [{"error": "KeyError: gdp", "resolution": "Column is gdp_trillions"}]

    tool_call_count: int = 0


class PersistentStateStore:
    """SQLite-backed store for AgentPersistentState, keyed by session_id."""

    def __init__(self, db_path: str | Path):
        self._db_path = str(db_path)
        conn = sqlite3.connect(self._db_path, check_same_thread=False)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS agent_persistent_state
            (session_id TEXT PRIMARY KEY, state_json TEXT, updated_at REAL)
        """)
        conn.commit()
        conn.close()

    def _connect(self) -> sqlite3.Connection:
        return sqlite3.connect(self._db_path, check_same_thread=False)

    def load(self, session_id: str) -> AgentPersistentState:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT state_json FROM agent_persistent_state WHERE session_id = ?",
                (session_id,),
            ).fetchone()
        if row:
            try:
                data = json.loads(row[0])
                return AgentPersistentState(**data)
            except Exception:
                return AgentPersistentState()
        return AgentPersistentState()

    def save(self, session_id: str, state: AgentPersistentState) -> None:
        with self._connect() as conn:
            conn.execute(
                "INSERT OR REPLACE INTO agent_persistent_state VALUES (?, ?, ?)",
                (session_id, json.dumps(asdict(state)), time.time()),
            )

    def delete(self, session_id: str) -> None:
        with self._connect() as conn:
            conn.execute(
                "DELETE FROM agent_persistent_state WHERE session_id = ?",
                (session_id,),
            )


class PersistentStateMiddleware(AgentMiddleware):
    """Maintains compact structured state outside message history.

    On every agent turn:
    - before_agent: injects current state as a SystemMessage (always fresh, never compacted)
    - awrap_tool_call: updates state after get_schema, save_artifact, query_duckdb calls
    """

    _STATE_MARKER = "[PERSISTENT STATE"

    def __init__(self, store: PersistentStateStore):
        self._store = store

    def _format_state(self, state: AgentPersistentState) -> str:
        lines = [self._STATE_MARKER + " — always current, never truncated]"]

        if state.schema:
            lines.append("Schema cache:")
            for tname, cols in state.schema.items():
                col_str = ", ".join(cols[:10]) + ("..." if len(cols) > 10 else "")
                lines.append(f"  {tname}: [{col_str}]")

        if state.plan_phases:
            lines.append("Plan:")
            for ph in state.plan_phases:
                icon = {"done": "✓", "in_progress": "→", "pending": "○"}.get(
                    ph.get("status", ""), "·"
                )
                lines.append(f"  {icon} {ph['name']} ({ph.get('status', '?')})")
                for step in ph.get("steps", [])[:6]:
                    s_icon = {"done": "    ✓", "in_progress": "    →", "pending": "    ○"}.get(
                        step.get("status", ""), "    ·"
                    )
                    lines.append(f"{s_icon} {step.get('label', step)}")
                if ph.get("findings"):
                    lines.append(f"    Findings: {'; '.join(ph['findings'][:3])}")

        if state.findings:
            lines.append("Recorded findings (call record_finding() to add more):")
            for f in state.findings[-12:]:
                lines.append(f"  • {f}")

        if state.python_namespace:
            lines.append("Python namespace (persisted vars):")
            for v in state.python_namespace[-8:]:
                lines.append(f"  • {v}")

        if state.artifacts:
            lines.append(f"Artifacts saved ({len(state.artifacts)} total):")
            for a in state.artifacts[-6:]:
                lines.append(f"  [{a.get('type', '?')}] {a.get('title', '?')} (id={a.get('id', '?')})")

        if state.errors_resolved:
            lines.append("Errors already resolved (don't repeat these mistakes):")
            for e in state.errors_resolved[-5:]:
                lines.append(f"  • {e['error']} → {e['resolution']}")

        lines.append(f"[Turn #{state.tool_call_count}]")
        return "\n".join(lines)

    def before_agent(self, state, runtime):
        """Inject persistent state as a SystemMessage before every agent turn."""
        session_id = current_session_id.get()
        if not session_id:
            return None

        ps = self._store.load(session_id)
        state_text = self._format_state(ps)

        messages = list(state.get("messages", []))

        # Remove any previous persistent state injection — always replace with fresh
        messages = [
            m for m in messages
            if not (isinstance(m, SystemMessage) and m.content.startswith(self._STATE_MARKER))
        ]

        # Insert after the first SystemMessage (main system prompt)
        insert_at = next(
            (i + 1 for i, m in enumerate(messages) if isinstance(m, SystemMessage)),
            0,
        )
        messages.insert(insert_at, SystemMessage(content=state_text))

        from langgraph.types import Overwrite
        return {"messages": Overwrite(messages)}

    async def awrap_tool_call(self, request, handler):
        """Update persistent state after relevant tool calls."""
        session_id = current_session_id.get()
        result = await handler(request)
        if not session_id:
            return result

        try:
            tc = request.tool_call
            tool_name = tc.get("name", "") if isinstance(tc, dict) else getattr(tc, "name", "")
            args = tc.get("args", {}) if isinstance(tc, dict) else getattr(tc, "args", {})
            result_text = result.content if hasattr(result, "content") else str(result)

            ps = self._store.load(session_id)
            ps.tool_call_count += 1

            # Cache schema after get_schema calls
            if tool_name == "get_schema":
                tname = args.get("table_name", "")
                if tname and result_text:
                    cols = re.findall(r"`([^`]+)`:\s*(\w+)", result_text)
                    if cols:
                        ps.schema[tname] = [f"{n}:{t}" for n, t in cols]
                        logger.debug("persistent_state: cached schema for %s (%d cols)", tname, len(cols))

            # Track artifacts saved
            if tool_name in ("save_artifact", "query_duckdb", "run_python") and "id=" in result_text:
                id_m = re.search(r"id=([a-z0-9\-]+)", result_text)
                title_m = re.search(r"(?:artifact|Saved [a-z]+ artifact): (.+?) \(id=", result_text)
                type_m = re.search(r"(chart|table|diagram) artifact", result_text)
                if id_m:
                    artifact_id = id_m.group(1)
                    # Avoid duplicates
                    existing_ids = {a.get("id") for a in ps.artifacts}
                    if artifact_id not in existing_ids:
                        ps.artifacts.append({
                            "id": artifact_id,
                            "title": title_m.group(1).strip() if title_m else "Artifact",
                            "type": type_m.group(1) if type_m else "artifact",
                        })

            # Track resolved errors (when error was followed by a successful fix)
            if tool_name == "run_python" and "Error:" in result_text:
                err_m = re.search(r"Error: ([^\n]{1,80})", result_text)
                if err_m:
                    error_str = err_m.group(1)
                    # Only track if not already recorded
                    existing = {e.get("error") for e in ps.errors_resolved}
                    if error_str not in existing:
                        ps.errors_resolved.append({
                            "error": error_str,
                            "resolution": "see recent tool history",
                        })

            self._store.save(session_id, ps)
        except Exception:
            logger.debug("persistent_state: update failed (non-critical)", exc_info=True)

        return result


def _get_default_db_path() -> Path:
    """Resolve the persistent state SQLite path from config."""
    try:
        from app.config import get_config
        cfg = get_config()
        # Store alongside the DuckDB data file
        duckdb_path = Path(cfg.data.duckdb_path)
        return duckdb_path.parent / "agent_state.sqlite"
    except Exception:
        return Path("./data/agent_state.sqlite")


# Module-level singleton — created once, reused across requests
_persistent_store: PersistentStateStore = PersistentStateStore(_get_default_db_path())
