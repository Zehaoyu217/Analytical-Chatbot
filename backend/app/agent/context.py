from __future__ import annotations

import contextvars
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.events.bus import EventBus

# Shared context variable for the current session ID.
# Set by executor_node before tool execution; read by tools that need it.
current_session_id: contextvars.ContextVar[str] = contextvars.ContextVar(
    "current_session_id", default="default"
)

# EventBus for A2UI streaming — agents at any depth emit events here.
# Set by chat.py before agent execution; read by executor, sub-agents, tools.
current_event_bus: contextvars.ContextVar[EventBus | None] = contextvars.ContextVar(
    "current_event_bus", default=None
)

# Model/provider config propagated to sub-agents.
current_model_config: contextvars.ContextVar[dict[str, str | None]] = contextvars.ContextVar(
    "current_model_config", default={"model": None, "provider": None}
)
