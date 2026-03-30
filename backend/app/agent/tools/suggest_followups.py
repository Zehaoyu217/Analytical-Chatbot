from __future__ import annotations

import asyncio
import json
from typing import Any

from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field, model_validator

from app.agent.context import current_session_id, current_event_bus
from app.events.bus import AgentEvent


class SuggestFollowupsInput(BaseModel):
    """Input schema for suggest_followups — accepts list directly or as JSON string."""
    suggestions: list[dict[str, Any]] = Field(
        description=(
            'A list of suggestion objects, each with: '
            '"label" (short chip text, max 50 chars), '
            '"prompt" (full question sent when clicked), '
            '"icon" (optional Material Symbols icon name)'
        ),
    )

    @model_validator(mode="before")
    @classmethod
    def _normalize(cls, values: Any) -> Any:
        if isinstance(values, dict):
            # Handle LLMs that send "suggestions_json" instead of "suggestions"
            if "suggestions_json" in values and "suggestions" not in values:
                raw = values.pop("suggestions_json")
                if isinstance(raw, str):
                    raw = json.loads(raw)
                values["suggestions"] = raw
            # Handle "suggestions" sent as a JSON string
            if isinstance(values.get("suggestions"), str):
                values["suggestions"] = json.loads(values["suggestions"])
        return values


def _suggest_followups(suggestions: list[dict[str, Any]]) -> str:
    if not isinstance(suggestions, list) or len(suggestions) == 0:
        return "Error: suggestions must be a non-empty array"

    # Validate and clean
    chips = []
    for s in suggestions[:4]:  # Max 4 suggestions
        if isinstance(s, dict) and "label" in s and "prompt" in s:
            chips.append({
                "label": s["label"][:50],
                "prompt": s["prompt"],
                "icon": s.get("icon", ""),
            })

    if not chips:
        return "Error: No valid suggestion chips found"

    # Emit via EventBus
    bus = current_event_bus.get()
    session_id = current_session_id.get()
    if bus and session_id:
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(bus.emit(session_id, AgentEvent(
                type="suggestions",
                data={"chips": chips},
                agent_id="orchestrator",
            )))
        except RuntimeError:
            pass

    labels = ", ".join(c["label"] for c in chips)
    return f"Follow-up suggestions shown to user: {labels}"


suggest_followups = StructuredTool.from_function(
    func=_suggest_followups,
    name="suggest_followups",
    description=(
        "Suggest follow-up analysis directions as clickable chips in the UI. "
        "Call at the END of analytical responses with 2-4 next steps."
    ),
    args_schema=SuggestFollowupsInput,
)
