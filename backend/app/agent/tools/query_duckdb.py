from __future__ import annotations

import json
from langchain_core.tools import tool

from app.agent.context import current_session_id, current_event_bus
from app.artifacts.store import Artifact, get_artifact_store
from app.data.duckdb_manager import get_duckdb


def _derive_title_from_sql(sql: str, columns: list, row_count: int) -> str:
    """Derive a descriptive title from the SQL query and result columns."""
    import re
    sql_clean = " ".join(sql.strip().split())  # normalize whitespace
    sql_upper = sql_clean.upper()

    # Try to extract the main table name
    from_match = re.search(r'\bFROM\s+(\w+)', sql_upper)
    table_name = from_match.group(1).lower() if from_match else None

    # Try to extract column descriptions
    col_parts = []
    for col in columns[:3]:  # Use first 3 columns for title
        col_clean = col.replace("_", " ").title()
        col_parts.append(col_clean)

    # Check for aggregation
    has_agg = any(fn in sql_upper for fn in ("AVG(", "SUM(", "COUNT(", "MIN(", "MAX(", "MEDIAN("))
    # Check for GROUP BY
    has_group = "GROUP BY" in sql_upper

    if col_parts:
        title = ", ".join(col_parts)
        if table_name and table_name not in title.lower():
            # Clean up hashed table names (e.g., "us_quarterly_macro_0047798b" → "us quarterly macro")
            clean_table = re.sub(r'_[a-f0-9]{6,}$', '', table_name).replace("_", " ").title()
            title = f"{title} — {clean_table}"
    else:
        title = f"Query Result"

    title += f" ({row_count} rows)"
    return title

def _auto_save_table_artifact(columns: list, rows: list, sql: str) -> str | None:
    """Auto-save query results as a structured JSON table artifact."""
    try:
        session_id = current_session_id.get()
        if not session_id:
            return None

        display_rows = rows[:100]  # Cap at 100 rows for display

        # Serialize rows — convert any non-JSON-serializable values to strings
        safe_rows = []
        for row in display_rows:
            safe_rows.append([None if v is None else (v if isinstance(v, (bool, int, float, str)) else str(v)) for v in row])

        content = json.dumps({
            "columns": columns,
            "rows": safe_rows,
            "total_rows": len(rows),
        })

        # Derive a descriptive title from the SQL
        title = _derive_title_from_sql(sql, columns, len(rows))

        store = get_artifact_store()
        artifact = Artifact(type="table", title=title, content=content, format="table-json")
        stored = store.add_artifact(session_id, artifact)

        # Emit artifact event via EventBus
        bus = current_event_bus.get()
        if bus and stored:
            import asyncio
            from app.events.bus import AgentEvent
            try:
                loop = asyncio.get_running_loop()
                loop.create_task(bus.emit(session_id, AgentEvent(
                    type="artifact",
                    data=stored.model_dump(),
                    agent_id="orchestrator",
                )))
            except RuntimeError:
                pass

        return stored.id
    except Exception:
        return None


@tool
def query_duckdb(sql: str) -> str:
    """Execute a SQL query against the DuckDB database and return results.

    Use standard SQL syntax. Available tables can be found with list_datasets().
    Table schemas can be inspected with get_schema().

    CRITICAL: DO NOT use this tool if the user asks for a chart or visualization.
    If a chart is requested, you MUST use `load_skill` then `run_python` to both
    query the data and draw the chart. This tool only outputs tables.

    Args:
        sql: The SQL query to execute. Must be a SELECT query (read-only).
    """
    # Basic safety check — only allow read operations
    stripped = sql.strip().upper()
    if not stripped.startswith("SELECT") and not stripped.startswith("WITH"):
        if any(stripped.startswith(kw) for kw in ("DROP", "DELETE", "INSERT", "UPDATE", "ALTER", "CREATE")):
            return "Error: Only SELECT/WITH queries are allowed for safety."

    db = get_duckdb()
    try:
        result = db.execute_query_raw(sql)
        columns = result["columns"]
        rows = result["rows"]

        if not rows:
            return f"Query returned 0 rows.\nColumns: {columns}"

        # Auto-save as artifact for the UI
        artifact_id = _auto_save_table_artifact(columns, rows, sql)

        # Format results for the model (up to 50 rows)
        lines = [f"Columns: {columns}", f"Rows returned: {len(rows)}", ""]
        for row in rows[:50]:
            lines.append(str(dict(zip(columns, row))))
        if len(rows) > 50:
            lines.append(f"... and {len(rows) - 50} more rows")
        if artifact_id:
            lines.append(f"\n[Table auto-saved as artifact {artifact_id}]")
        return "\n".join(lines)

    except Exception as e:
        error_msg = str(e).lower()
        if "not found" in error_msg or "does not exist" in error_msg or "no column" in error_msg:
            return (
                f"SQL Error: {e}\n"
                "COLUMN OR TABLE NOT FOUND. Call get_schema(table_name) to verify the exact "
                "column names, then fix your query and retry."
            )
        return (
            f"SQL Error: {e}\n"
            "Fix the query and retry. If unsure about column names, call get_schema(table_name)."
        )
