from __future__ import annotations

import asyncio
import json

from langchain_core.tools import tool

from app.agent.context import current_session_id, current_event_bus
from app.events.bus import AgentEvent


@tool
def show_component(components: str, title: str = "") -> str:
    """Render one or more A2UI components inline in the current chat message.

    Use this to answer questions with rich visual components directly in the
    conversation — metric cards, alerts, comparisons, lists, progress bars, etc.
    Components appear in the chat bubble, NOT in the Workspace dashboard.

    For components that need computed values, use run_python and call the built-in
    show_component(dict_or_list, title) helper inside your code instead.

    Args:
        components: JSON string — a single component dict OR a list of component dicts.
                    Each dict must have a "type" field. Supported types: metric, alert,
                    comparison, list, progress, divider, table, text, grid, cols_2.
        title: Optional group title shown above the component block in the chat.
    """
    session_id = current_session_id.get()

    try:
        parsed = json.loads(components)
    except (json.JSONDecodeError, TypeError) as e:
        return f"Error: Invalid JSON for components — {e}. Pass a valid JSON object or array."

    if isinstance(parsed, dict):
        component_list = [parsed]
    elif isinstance(parsed, list):
        component_list = parsed
    else:
        return "Error: components must be a JSON object or array of objects."

    if not component_list:
        return "Error: components list is empty."

    bus = current_event_bus.get()
    if bus and session_id:
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(bus.emit(session_id, AgentEvent(
                type="inline_component",
                data={"components": component_list, "title": title},
                agent_id="orchestrator",
            )))
        except RuntimeError:
            pass  # No running event loop — likely called outside async context

    return (
        f"Rendered {len(component_list)} inline component(s) in chat"
        + (f" — {title}" if title else "") + "."
    )
