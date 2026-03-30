from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.events.bus import EventBus, AgentEvent
from app.agent.agents.registry import AgentCard, AgentRegistry
from app.artifacts.store import ArtifactStore


@pytest.fixture
def event_bus():
    return EventBus()


@pytest.fixture
def agent_registry():
    return AgentRegistry()


@pytest.fixture
def artifact_store():
    return ArtifactStore()


@pytest.fixture
def sample_agent_card():
    """A minimal AgentCard for testing."""
    mock_tool = MagicMock()
    mock_tool.name = "test_tool"
    return AgentCard(
        name="test_agent",
        description="A test agent for unit testing",
        system_prompt="You are a test agent. Respond with 'OK'.",
        tools=[mock_tool],
        skills=["testing"],
    )


@pytest.fixture
def mock_llm():
    """A mock LLM that returns a canned response."""
    from langchain_core.messages import AIMessage

    llm = AsyncMock()
    response = AIMessage(content="Test response from mock LLM")
    response.tool_calls = []
    llm.ainvoke = AsyncMock(return_value=response)
    llm.bind_tools = MagicMock(return_value=llm)
    return llm
