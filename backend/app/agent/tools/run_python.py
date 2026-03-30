from __future__ import annotations

import asyncio
import difflib
import logging
import re
from langchain_core.tools import tool

from app.agent.context import current_session_id, current_event_bus
from app.artifacts.store import Artifact, get_artifact_store
from app.events.bus import AgentEvent
from app.sandbox.executor import SandboxResult

logger = logging.getLogger(__name__)


async def _process_result(result: SandboxResult, session_id: str | None) -> str:
    """Turn a SandboxResult into the string the agent sees.

    Saves artifacts to the store, emits inline_component events, returns a
    human-readable summary string.
    """
    parts: list[str] = []

    if result.error:
        parts.append(f"Error: {result.error}")
        error_lower = result.error.lower()
        if "keyerror" in error_lower or "column" in error_lower or "not found" in error_lower:
            key_match = re.search(r"KeyError: ['\"]([^'\"]+)['\"]", result.error)
            bad_key = key_match.group(1) if key_match else None
            try:
                from app.data.catalog import get_catalog
                from app.data.duckdb_manager import get_duckdb
                db = get_duckdb()
                catalog = get_catalog()
                all_cols: list[str] = []
                schema_lines: list[str] = []
                for ds in catalog.list_datasets():
                    tname = ds["table_name"]
                    schema = db.get_table_schema(tname)
                    cols = [c["name"] for c in schema]
                    all_cols.extend(cols)
                    schema_lines.append(f"  {tname}: {cols}")
                hint_lines = ["COLUMN NOT FOUND. Available columns:"] + schema_lines
                if bad_key and all_cols:
                    close = difflib.get_close_matches(bad_key, all_cols, n=3, cutoff=0.5)
                    if close:
                        hint_lines.append(f"Did you mean: {close}?")
                hint_lines.append("Fix the column name and retry.")
                parts.insert(0, "\n".join(hint_lines))
            except Exception:
                parts.append(
                    "COLUMN/KEY NOT FOUND. Call get_schema(table_name) to check actual column "
                    "names, then fix your code and retry."
                )
        elif "import" in error_lower or "module" in error_lower:
            parts.append(
                "IMPORT ERROR. Available packages: pandas, numpy, matplotlib, seaborn, "
                "plotly, scipy, scikit-learn, statsmodels, duckdb, altair."
            )
        else:
            parts.append(
                "FIX THE ERROR AND RETRY. Read the error message carefully, "
                "correct your code, and call run_python again."
            )

    if result.stdout:
        parts.append(f"Output:\n{result.stdout}")
    if result.stderr:
        parts.append(f"Stderr:\n{result.stderr}")
    if result.figures:
        parts.append(f"Generated {len(result.figures)} matplotlib figure(s)")

    store = get_artifact_store()
    bus = current_event_bus.get()

    for chart_data in result.charts:
        title = chart_data.get("title", "Chart")
        spec = chart_data.get("spec", "")
        artifact = Artifact(type="chart", title=title, content=spec, format="vega-lite")
        stored = store.add_artifact(session_id, artifact)
        try:
            import json as _json
            spec_obj = _json.loads(spec) if isinstance(spec, str) else spec
            encoding = spec_obj.get("encoding", {})
            mark = spec_obj.get("mark", {})
            mark_type = mark.get("type", mark) if isinstance(mark, dict) else mark
            fields = [f"{k}={v.get('field', '?')}" for k, v in encoding.items()
                      if isinstance(v, dict) and "field" in v]
            chart_summary = f"type={mark_type}, {', '.join(fields)}"
        except Exception:
            chart_summary = "vega-lite"
        parts.append(
            f"Saved chart artifact: {title} (id={stored.id}, {chart_summary}). "
            f"Chart is visible in Artifacts panel and inline in the chat."
        )
        logger.info("run_python: saved chart artifact '%s' to session %s", title, session_id)

    for table_data in result.tables_html:
        title = table_data.get("title", "Table")
        html = table_data.get("html", "")
        artifact = Artifact(type="table", title=title, content=html, format="html")
        stored = store.add_artifact(session_id, artifact)
        row_count = html.count("<tr>") - 1
        parts.append(
            f"Saved table artifact: {title} (id={stored.id}, ~{max(0, row_count)} rows). "
            f"Table is visible in Artifacts panel and inline in the chat."
        )
        logger.info("run_python: saved table artifact '%s' to session %s", title, session_id)

    for diagram_data in result.diagrams:
        title = diagram_data.get("title", "Diagram")
        code = diagram_data.get("code", "")
        artifact = Artifact(type="diagram", title=title, content=code, format="mermaid")
        stored = store.add_artifact(session_id, artifact)
        parts.append(
            f"Saved diagram artifact: {title} (id={stored.id}). "
            f"Diagram is visible in Artifacts panel and inline in the chat."
        )
        logger.info("run_python: saved diagram artifact '%s' to session %s", title, session_id)

    for update_data in result.artifact_updates:
        artifact_id = update_data.get("artifact_id", "")
        new_content = update_data.get("content", "")
        new_title = update_data.get("title")
        if not artifact_id or not new_content:
            continue
        existing = store.get_artifact(session_id, artifact_id)
        if not existing:
            parts.append(f"Warning: update_artifact('{artifact_id}') — artifact not found in session")
            continue
        update_kwargs: dict = {"content": new_content}
        if new_title:
            update_kwargs["title"] = new_title
        updated = store.update_artifact(session_id, artifact_id, **update_kwargs)
        if bus and updated and session_id:
            try:
                loop = asyncio.get_running_loop()
                loop.create_task(bus.emit(session_id, AgentEvent(
                    type="artifact",
                    data=updated.model_dump(),
                    agent_id="orchestrator",
                )))
            except RuntimeError:
                pass
        parts.append(
            f"Updated artifact [{artifact_id}] '{new_title or existing.title}' — "
            f"Artifacts panel will reflect the change immediately."
        )
        logger.info("run_python: updated artifact '%s' in session %s", artifact_id, session_id)

    for group_data in result.inline_components:
        components = group_data.get("components", [])
        title = group_data.get("title", "")
        if not components:
            continue
        if bus and session_id:
            try:
                loop = asyncio.get_running_loop()
                loop.create_task(bus.emit(session_id, AgentEvent(
                    type="inline_component",
                    data={"components": components, "title": title},
                    agent_id="orchestrator",
                )))
            except RuntimeError:
                pass
        parts.append(
            f"Rendered {len(components)} inline component(s) in chat"
            + (f" — {title}" if title else "") + "."
        )
        logger.info("run_python: emitted inline_component group '%s' (%d components) to session %s",
                    title, len(components), session_id)

    return "\n".join(parts) if parts else "Code executed successfully (no output)"


@tool
async def run_python(code: str) -> str:
    """Execute Python code in a sandboxed environment with access to pandas, numpy, matplotlib, altair, duckdb, and more.

    The sandbox has a pre-connected DuckDB instance available as `_db`.
    Use `_db.execute("SELECT ...")` to query data.

    Built-in helpers (always available — no import needed):
    - `save_artifact(content, title)` — universal save: DataFrame/HTML string → table, Altair chart → chart, Mermaid string → diagram
    - `update_artifact(artifact_id, content, title=None)` — update an EXISTING artifact in-place (use for refinement requests)
    - `gs_theme(chart, title, width, height)` — apply OneGS dark theme to any Altair chart before saving
    - `styled_table_html(df, title)` — build an enterprise HTML table string from a DataFrame
    - `GS_MERMAID_THEME` — string constant; prepend to any Mermaid diagram for GS dark styling
    - `PRIMARY, ACCENT_PURPLE, CAT_PALETTE, W_STANDARD, H_STANDARD, ...` — OneGS chart constants
    - `print_full(df)` — print DataFrame without truncation
    - `save_table_html`, `save_chart_vegalite`, `save_mermaid` — lower-level alternatives to save_artifact
    - `show_component(component_or_list, title)` — render A2UI component(s) inline in the chat bubble

    IMPORTANT: Always use print() or print_full() to output results so you can see them.

    Args:
        code: Python code to execute. Print results to stdout for them to be captured.
    """
    # Strip JSON escape artifacts that some models leak at the end of code strings.
    code = code.rstrip()
    while code.endswith('"}') or code.endswith("'}"):
        code = code[:-2].rstrip()

    session_id = current_session_id.get()

    from app.sandbox.executor import execute_python
    result = await asyncio.to_thread(execute_python, code, session_id)

    logger.info("run_python: session=%s charts=%d tables=%d diagrams=%d error=%s",
                session_id, len(result.charts), len(result.tables_html),
                len(result.diagrams), result.error[:80] if result.error else None)
    return await _process_result(result, session_id)
