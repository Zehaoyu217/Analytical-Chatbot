from __future__ import annotations

import logging
from langchain_core.tools import tool

from app.agent.context import current_session_id
from app.artifacts.store import Artifact, get_artifact_store
from app.sandbox.executor import execute_python

logger = logging.getLogger(__name__)


@tool
async def run_python(code: str) -> str:
    """Execute Python code in a sandboxed environment with access to pandas, numpy, matplotlib, altair, duckdb, and more.

    The sandbox has a pre-connected DuckDB instance available as `_db`.
    Use `_db.execute("SELECT ...")` to query data.

    Helper functions available in the sandbox:
    - `print_full(df)` — Print a DataFrame without truncation so you can see all rows/columns
    - `save_table_html(df, title)` — Save a DataFrame as an HTML artifact for the Artifacts panel
    - `save_chart_vegalite(chart, title)` — Save an Altair chart as a Vega-Lite artifact
    - `save_mermaid(code, title)` — Save a Mermaid diagram as an artifact

    IMPORTANT: Always use print() or print_full() to output results so you can see them.
    Matplotlib figures are automatically captured. Altair charts should be saved with save_chart_vegalite().

    Args:
        code: Python code to execute. Print results to stdout for them to be captured.
    """
    session_id = current_session_id.get()
    from app.agent.context import current_event_bus
    bus = current_event_bus.get()
    from app.llm.provider import get_chat_model
    from app.events.bus import AgentEvent
    import asyncio

    max_retries = 3
    current_code = code
    result = None

    for attempt in range(max_retries):
        result = execute_python(current_code)
        if not result.error:
            # Success!
            break
            
        # Error occurred. If we have retries left, trigger Auto-Reflexion
        if attempt < max_retries - 1:
            error_short = result.error[:150].replace('\n', ' ')
            if bus:
                await bus.emit(session_id, AgentEvent(
                    type="progress",
                    data={
                        "id": f"reflexion_{attempt}",
                        "label": "Auto-correcting Python syntax...",
                        "status": "running",
                        "detail": f"Attempt {attempt + 1}: {error_short}",
                        "started_at": None,
                        "finished_at": None,
                    },
                    agent_id="orchestrator"
                ))
            
            prompt = (
                f"The following Python code produced an error:\n```python\n{current_code}\n```\n"
                f"Error:\n{result.error}\n\n"
                "Fix the code to resolve this error. Return ONLY the valid Python code wrapped in ```python ... ```. "
                "Do not include any other text or explanations."
            )
            
            try:
                llm = get_chat_model(temperature=0.0) 
                repair_res = await llm.ainvoke(prompt)
                repair_text = getattr(repair_res, "content", str(repair_res))

                if "```python" in repair_text:
                    current_code = repair_text.split("```python")[1].split("```")[0].strip()
                elif "```" in repair_text:
                    current_code = repair_text.split("```")[1].split("```")[0].strip()
                else:
                    current_code = repair_text.strip()
            except Exception as e:
                logger.warning("Reflexion LLM failed: %s", e)
                
            if bus:
                await bus.emit(session_id, AgentEvent(
                    type="progress",
                    data={
                        "id": f"reflexion_{attempt}",
                        "label": "Auto-correcting Python syntax...",
                        "status": "done",
                        "detail": "Retrying sandbox execution with fixed code.",
                        "started_at": None,
                        "finished_at": None,
                    },
                    agent_id="orchestrator"
                ))

    session_id = current_session_id.get()
    logger.info("run_python: session=%s, charts=%d, tables=%d, diagrams=%d, error=%s",
                session_id, len(result.charts), len(result.tables_html),
                len(result.diagrams), result.error[:80] if result.error else None)

    parts = []
    if result.error:
        parts.append(f"Error: {result.error}")
        error_lower = result.error.lower()
        if "keyerror" in error_lower or "column" in error_lower or "not found" in error_lower:
            parts.append(
                "COLUMN/KEY NOT FOUND. Call get_schema(table_name) to check the actual column "
                "names, then fix your code with the correct names and retry."
            )
        elif "import" in error_lower or "module" in error_lower:
            parts.append(
                "IMPORT ERROR. Check the correct module path and retry. "
                "Available packages: pandas, numpy, matplotlib, seaborn, plotly, scipy, "
                "scikit-learn, statsmodels, duckdb, altair."
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

    # Extract charts and tables from sandbox and save them as real artifacts
    store = get_artifact_store()
    session_id = current_session_id.get()

    for chart_data in result.charts:
        title = chart_data.get("title", "Chart")
        spec = chart_data.get("spec", "")
        artifact = Artifact(type="chart", title=title, content=spec, format="vega-lite")
        stored = store.add_artifact(session_id, artifact)
        # Give agent a summary of the chart spec so it knows what was created
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
            f"This chart is now visible in the Artifacts panel and inline in the chat."
        )
        logger.info("run_python: saved chart artifact '%s' to session %s", title, session_id)

    for table_data in result.tables_html:
        title = table_data.get("title", "Table")
        html = table_data.get("html", "")
        artifact = Artifact(type="table", title=title, content=html, format="html")
        stored = store.add_artifact(session_id, artifact)
        # Count rows in the HTML table for agent context
        row_count = html.count("<tr>") - 1  # subtract header row
        parts.append(
            f"Saved table artifact: {title} (id={stored.id}, ~{max(0, row_count)} rows). "
            f"This table is now visible in the Artifacts panel and inline in the chat."
        )
        logger.info("run_python: saved table artifact '%s' to session %s", title, session_id)

    for diagram_data in result.diagrams:
        title = diagram_data.get("title", "Diagram")
        code = diagram_data.get("code", "")
        artifact = Artifact(type="diagram", title=title, content=code, format="mermaid")
        stored = store.add_artifact(session_id, artifact)
        parts.append(
            f"Saved diagram artifact: {title} (id={stored.id}). "
            f"This diagram is now visible in the Artifacts panel and inline in the chat."
        )
        logger.info("run_python: saved diagram artifact '%s' to session %s", title, session_id)

    return "\n".join(parts) if parts else "Code executed successfully (no output)"
