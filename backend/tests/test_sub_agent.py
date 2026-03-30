from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.agent.agents.registry import AgentCard
from app.agent.agents.sub_agent import run_sub_agent
from app.agent.context import current_event_bus, current_session_id
from app.events.bus import AgentEvent, EventBus


@pytest.fixture
def profiler_card():
    mock_tool = MagicMock()
    mock_tool.name = "query_duckdb"
    mock_tool.ainvoke = AsyncMock(return_value="result: 100 rows")
    return AgentCard(
        name="data_profiler",
        description="Profiles datasets",
        system_prompt="You are a data profiler.",
        tools=[mock_tool],
        skills=["profiling"],
    )


async def test_run_sub_agent_returns_result(profiler_card: AgentCard):
    """Sub-agent should return the LLM response content."""
    bus = EventBus()
    token_bus = current_event_bus.set(bus)
    token_sid = current_session_id.set("test-session")

    with patch("app.agent.agents.sub_agent.get_chat_model") as mock_get_model, \
         patch("app.agent.nodes.executor._get_data_context", return_value=""):
        from langchain_core.messages import AIMessage

        mock_llm = AsyncMock()
        response = AIMessage(content="Dataset has 100 rows and 5 columns.")
        response.tool_calls = []
        mock_llm.ainvoke = AsyncMock(return_value=response)
        mock_llm.bind_tools = MagicMock(return_value=mock_llm)
        mock_get_model.return_value = mock_llm

        result = await run_sub_agent(
            card=profiler_card,
            task="Profile the sales dataset",
            session_id="test-session",
        )

    current_event_bus.reset(token_bus)
    current_session_id.reset(token_sid)

    assert "100 rows" in result


async def test_sub_agent_emits_lifecycle_events(profiler_card: AgentCard):
    """Sub-agent emits agent_status started + completed events."""
    bus = EventBus()
    token_bus = current_event_bus.set(bus)
    token_sid = current_session_id.set("test-session")

    with patch("app.agent.agents.sub_agent.get_chat_model") as mock_get_model, \
         patch("app.agent.nodes.executor._get_data_context", return_value=""):
        from langchain_core.messages import AIMessage

        mock_llm = AsyncMock()
        response = AIMessage(content="Done.")
        response.tool_calls = []
        mock_llm.ainvoke = AsyncMock(return_value=response)
        mock_llm.bind_tools = MagicMock(return_value=mock_llm)
        mock_get_model.return_value = mock_llm

        await run_sub_agent(
            card=profiler_card,
            task="Test task",
            session_id="test-session",
        )

    # Terminate bus so we can consume
    await bus.emit("test-session", AgentEvent(type="done", data={}))

    events = []
    async for event in bus.consume("test-session"):
        events.append(event)

    current_event_bus.reset(token_bus)
    current_session_id.reset(token_sid)

    agent_status_events = [e for e in events if e.type == "agent_status"]
    assert len(agent_status_events) == 2
    assert agent_status_events[0].data["status"] == "started"
    assert agent_status_events[1].data["status"] == "completed"
    assert agent_status_events[0].data["agent_name"] == "data_profiler"


async def test_sub_agent_emits_tool_events(profiler_card: AgentCard):
    """Sub-agent emits tool_start and tool_end when using tools."""
    bus = EventBus()
    token_bus = current_event_bus.set(bus)
    token_sid = current_session_id.set("test-session")

    with patch("app.agent.agents.sub_agent.get_chat_model") as mock_get_model, \
         patch("app.agent.nodes.executor._get_data_context", return_value=""):
        from langchain_core.messages import AIMessage

        # First response has a tool call
        response1 = AIMessage(content="")
        response1.tool_calls = [{
            "name": "query_duckdb",
            "args": {"sql": "SELECT COUNT(*) FROM sales"},
            "id": "call_123",
        }]
        # Second response has no tool calls (final answer)
        response2 = AIMessage(content="There are 100 rows.")
        response2.tool_calls = []

        mock_llm = AsyncMock()
        mock_llm.ainvoke = AsyncMock(side_effect=[response1, response2])
        mock_llm.bind_tools = MagicMock(return_value=mock_llm)
        mock_get_model.return_value = mock_llm

        await run_sub_agent(
            card=profiler_card,
            task="Count rows",
            session_id="test-session",
        )

    await bus.emit("test-session", AgentEvent(type="done", data={}))

    events = []
    async for event in bus.consume("test-session"):
        events.append(event)

    current_event_bus.reset(token_bus)
    current_session_id.reset(token_sid)

    tool_starts = [e for e in events if e.type == "tool_start"]
    tool_ends = [e for e in events if e.type == "tool_end"]
    assert len(tool_starts) == 1
    assert len(tool_ends) == 1
    assert tool_starts[0].data["tool"] == "query_duckdb"
    assert "elapsed_s" in tool_ends[0].data


async def test_sub_agent_handles_failure(profiler_card: AgentCard):
    """Sub-agent emits agent_status failed on error."""
    bus = EventBus()
    token_bus = current_event_bus.set(bus)
    token_sid = current_session_id.set("test-session")

    with patch("app.agent.agents.sub_agent.get_chat_model") as mock_get_model, \
         patch("app.agent.nodes.executor._get_data_context", return_value=""):
        mock_get_model.side_effect = RuntimeError("LLM unavailable")

        result = await run_sub_agent(
            card=profiler_card,
            task="Test failure",
            session_id="test-session",
        )

    await bus.emit("test-session", AgentEvent(type="done", data={}))

    events = []
    async for event in bus.consume("test-session"):
        events.append(event)

    current_event_bus.reset(token_bus)
    current_session_id.reset(token_sid)

    assert "failed" in result
    status_events = [e for e in events if e.type == "agent_status"]
    failed = [e for e in status_events if e.data.get("status") == "failed"]
    assert len(failed) == 1
