from __future__ import annotations

import asyncio
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, AsyncIterator


@dataclass
class AgentEvent:
    """A structured event emitted by any agent (orchestrator or sub-agent) for A2UI streaming."""

    type: str  # agent_status | thinking | tool_start | tool_end | progress | artifact | dashboard | message | done | error
    data: dict[str, Any]
    agent_id: str = "orchestrator"
    parent_agent_id: str | None = None
    timestamp: float = field(default_factory=time.time)
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:8])


class EventBus:
    """Per-session async event queue.

    Agents (orchestrator + sub-agents) write events via emit().
    The SSE generator reads events via consume().
    This decouples event production from SSE transport.
    """

    def __init__(self) -> None:
        self._queues: dict[str, asyncio.Queue[AgentEvent]] = {}

    def get_queue(self, session_id: str) -> asyncio.Queue[AgentEvent]:
        if session_id not in self._queues:
            self._queues[session_id] = asyncio.Queue()
        return self._queues[session_id]

    async def emit(self, session_id: str, event: AgentEvent) -> None:
        """Write an event to the session's queue."""
        queue = self.get_queue(session_id)
        await queue.put(event)

    async def consume(self, session_id: str) -> AsyncIterator[AgentEvent]:
        """Read events from the session's queue until a 'done' or 'error' event."""
        queue = self.get_queue(session_id)
        while True:
            event = await queue.get()
            yield event
            if event.type in ("done", "error"):
                break

    def cleanup(self, session_id: str) -> None:
        """Remove the queue for a session."""
        self._queues.pop(session_id, None)

    def has_queue(self, session_id: str) -> bool:
        return session_id in self._queues


_bus: EventBus | None = None


def get_event_bus() -> EventBus:
    global _bus
    if _bus is None:
        _bus = EventBus()
    return _bus
