from __future__ import annotations

import asyncio

import pytest

from app.events.bus import AgentEvent, EventBus


async def test_emit_and_consume_round_trip(event_bus: EventBus):
    """Events emitted to a session can be consumed in order."""
    sid = "test-session"

    await event_bus.emit(sid, AgentEvent(type="progress", data={"label": "Step 1"}))
    await event_bus.emit(sid, AgentEvent(type="progress", data={"label": "Step 2"}))
    await event_bus.emit(sid, AgentEvent(type="done", data={"session_id": sid}))

    events = []
    async for event in event_bus.consume(sid):
        events.append(event)

    assert len(events) == 3
    assert events[0].type == "progress"
    assert events[0].data["label"] == "Step 1"
    assert events[1].data["label"] == "Step 2"
    assert events[2].type == "done"


async def test_consume_terminates_on_done(event_bus: EventBus):
    """consume() stops iterating when it receives a 'done' event."""
    sid = "term-test"

    await event_bus.emit(sid, AgentEvent(type="progress", data={"label": "before"}))
    await event_bus.emit(sid, AgentEvent(type="done", data={}))
    await event_bus.emit(sid, AgentEvent(type="progress", data={"label": "after"}))

    events = []
    async for event in event_bus.consume(sid):
        events.append(event)

    # Should only get 2 events: progress + done (not the one after done)
    assert len(events) == 2
    assert events[-1].type == "done"


async def test_consume_terminates_on_error(event_bus: EventBus):
    """consume() also stops on 'error' events."""
    sid = "err-test"

    await event_bus.emit(sid, AgentEvent(type="error", data={"error": "boom"}))

    events = []
    async for event in event_bus.consume(sid):
        events.append(event)

    assert len(events) == 1
    assert events[0].type == "error"


async def test_cleanup_removes_queue(event_bus: EventBus):
    """cleanup() removes the session queue."""
    sid = "cleanup-test"
    event_bus.get_queue(sid)
    assert event_bus.has_queue(sid)

    event_bus.cleanup(sid)
    assert not event_bus.has_queue(sid)


async def test_concurrent_producers(event_bus: EventBus):
    """Multiple producers can write to the same session queue concurrently."""
    sid = "concurrent-test"

    async def producer(agent_id: str, count: int):
        for i in range(count):
            await event_bus.emit(sid, AgentEvent(
                type="progress",
                data={"label": f"{agent_id}-{i}"},
                agent_id=agent_id,
            ))

    # Run two producers concurrently
    await asyncio.gather(
        producer("orchestrator", 3),
        producer("sub_agent", 3),
    )
    # Terminate
    await event_bus.emit(sid, AgentEvent(type="done", data={}))

    events = []
    async for event in event_bus.consume(sid):
        events.append(event)

    # 3 + 3 + 1 done = 7
    assert len(events) == 7
    agent_ids = {e.agent_id for e in events if e.type == "progress"}
    assert "orchestrator" in agent_ids
    assert "sub_agent" in agent_ids


async def test_event_has_id_and_timestamp(event_bus: EventBus):
    """Each AgentEvent has a unique id and timestamp."""
    e1 = AgentEvent(type="progress", data={})
    e2 = AgentEvent(type="progress", data={})

    assert e1.id != e2.id
    assert e1.timestamp > 0
    assert e2.timestamp >= e1.timestamp


async def test_agent_hierarchy_fields():
    """AgentEvent preserves agent_id and parent_agent_id."""
    event = AgentEvent(
        type="tool_start",
        data={"tool": "query_duckdb"},
        agent_id="profiler_abc123",
        parent_agent_id="orchestrator",
    )
    assert event.agent_id == "profiler_abc123"
    assert event.parent_agent_id == "orchestrator"
