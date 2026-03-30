from __future__ import annotations

import json

from langchain_core.tools import tool

from app.agent.context import current_session_id, current_event_bus
from app.artifacts.store import Artifact, get_artifact_store


@tool
def save_artifact(
    title: str,
    content: str,
    artifact_type: str = "table",
    format: str = "html",
) -> str:
    """Save an artifact (table, chart, or diagram) that will be displayed in the Artifacts panel.

    Use this to persist important results so the user can reference them later.
    The artifact will appear in the right-side Artifacts panel in real-time.

    Args:
        title: A descriptive title for the artifact (e.g., "Sales by Region", "Monthly Trend").
        content: The artifact content:
            - For tables: HTML table string (use df.to_html())
            - For charts: Vega-Lite JSON spec string (use alt.Chart().to_json())
            - For diagrams: Mermaid diagram string (e.g., "graph TD; A-->B;")
        artifact_type: One of "table", "chart", "diagram".
        format: The content format — "html" for tables, "vega-lite" for Altair charts, "mermaid" for diagrams.
    """
    store = get_artifact_store()
    session_id = current_session_id.get()

    artifact = Artifact(
        type=artifact_type,
        title=title,
        content=content,
        format=format,
    )
    stored = store.add_artifact(session_id, artifact)
    # Provide content summary so the agent knows what was saved
    content_preview = content[:150] + "..." if len(content) > 150 else content
    return (
        f"Artifact saved: [{stored.id}] {title} ({artifact_type}/{format}). "
        f"Now visible in Artifacts panel and inline in chat. "
        f"Preview: {content_preview}"
    )


@tool
def update_artifact(
    artifact_id: str,
    title: str | None = None,
    content: str | None = None,
) -> str:
    """Update an existing artifact (chart, table, or diagram) by its ID.

    Use this to modify a previously saved artifact — for example, to refine a chart,
    fix a table, or update content after a second-pass analysis.

    Args:
        artifact_id: The ID of the artifact to update (returned when the artifact was saved).
        title: New title (optional — leave None to keep the current title).
        content: New content (optional — the full replacement content, same format as original).
    """
    store = get_artifact_store()
    session_id = current_session_id.get()

    existing = store.get_artifact(session_id, artifact_id)
    if not existing:
        return f"Error: No artifact found with id '{artifact_id}' in current session"

    updates = {}
    if title is not None:
        updates["title"] = title
    if content is not None:
        updates["content"] = content

    if not updates:
        return f"No changes specified for artifact '{artifact_id}'"

    updated = store.update_artifact(session_id, artifact_id, **updates)

    # Re-emit artifact event via EventBus so frontend receives the update
    bus = current_event_bus.get()
    if bus and updated:
        import asyncio
        from app.events.bus import AgentEvent
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(bus.emit(session_id, AgentEvent(
                type="artifact",
                data=updated.model_dump(),
                agent_id="orchestrator",
            )))
        except RuntimeError:
            pass  # No event loop available (e.g., sync context)

    return (
        f"Artifact updated: [{artifact_id}] {title or existing.title} ({existing.type}/{existing.format}). "
        f"The UI will reflect the updated content."
    )


@tool
def get_artifact_content(
    artifact_id: str | None = None,
) -> str:
    """List all saved artifacts in this session, or get the full content of a specific artifact.

    Use this to:
    - See what artifacts have already been created (call without artifact_id)
    - Read an existing artifact's content to build upon it or create a derivative
    - Reference previous results without recomputing

    Args:
        artifact_id: Optional. If provided, returns the full content of that artifact.
                     If omitted, returns a summary list of all artifacts.
    """
    store = get_artifact_store()
    session_id = current_session_id.get()

    if artifact_id:
        artifact = store.get_artifact(session_id, artifact_id)
        if not artifact:
            return f"Error: No artifact found with id '{artifact_id}' in current session"
        return (
            f"Artifact [{artifact.id}] '{artifact.title}' ({artifact.type}/{artifact.format})\n"
            f"Created: {artifact.created_at}\n"
            f"Content:\n{artifact.content}"
        )

    # List all artifacts with summaries
    artifacts = store.get_artifacts(session_id)
    if not artifacts:
        return "No artifacts saved in this session yet."

    lines = [f"Session has {len(artifacts)} artifact(s):\n"]
    for a in artifacts:
        preview = a.content[:100] + "..." if len(a.content) > 100 else a.content
        lines.append(f"  [{a.id}] {a.title} ({a.type}/{a.format}) — {preview}")
    return "\n".join(lines)


@tool
def save_dashboard_component(
    component_json: str,
    title: str = "",
) -> str:
    """Save a dashboard component that will be rendered in the Agent Workspace.

    The component updates the dashboard in real-time as it's built.

    Args:
        component_json: A JSON string defining the component structure.
            Supported types: "metric" (KPI cards), "grid" (layout), "text" (text blocks).
        title: Optional title for the component.
    """
    store = get_artifact_store()
    session_id = current_session_id.get()

    try:
        component = json.loads(component_json)
    except json.JSONDecodeError:
        return "Error: Invalid JSON for dashboard component"

    if title:
        component["_title"] = title

    store.add_dashboard_component(session_id, component)
    return f"Dashboard component saved: {title or 'untitled'}"
