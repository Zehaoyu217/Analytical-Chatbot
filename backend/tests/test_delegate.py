from __future__ import annotations

from unittest.mock import patch, AsyncMock

import pytest

from app.agent.context import current_session_id, current_model_config
from app.agent.tools.delegate import delegate_to_agent
from app.agent.agents.registry import AgentCard, AgentRegistry


async def test_delegate_unknown_agent():
    """Delegating to unknown agent returns error with available agents list."""
    token_sid = current_session_id.set("test")
    token_model = current_model_config.set({"model": None, "provider": None})

    registry = AgentRegistry()
    registry.register(AgentCard(
        name="data_profiler",
        description="Profiles data",
        system_prompt="test",
    ))

    with patch("app.agent.agents.registry.get_agent_registry", return_value=registry):
        result = await delegate_to_agent.ainvoke({
            "agent_name": "nonexistent",
            "task": "do something",
        })

    current_session_id.reset(token_sid)
    current_model_config.reset(token_model)

    assert "Unknown agent" in result
    assert "data_profiler" in result


async def test_delegate_calls_sub_agent():
    """Delegating to a valid agent calls run_sub_agent and returns its result."""
    token_sid = current_session_id.set("test")
    token_model = current_model_config.set({"model": "test-model", "provider": "test-provider"})

    registry = AgentRegistry()
    card = AgentCard(
        name="sql_analyst",
        description="SQL analysis",
        system_prompt="test",
    )
    registry.register(card)

    with patch("app.agent.agents.registry.get_agent_registry", return_value=registry), \
         patch("app.agent.agents.sub_agent.run_sub_agent", new_callable=AsyncMock) as mock_run:
        mock_run.return_value = "Analysis result: 42 rows matched"

        result = await delegate_to_agent.ainvoke({
            "agent_name": "sql_analyst",
            "task": "Count matching rows",
        })

    current_session_id.reset(token_sid)
    current_model_config.reset(token_model)

    assert result == "Analysis result: 42 rows matched"
    mock_run.assert_called_once()
    call_kwargs = mock_run.call_args
    assert call_kwargs.kwargs["card"] == card
    assert call_kwargs.kwargs["task"] == "Count matching rows"
    assert call_kwargs.kwargs["model"] == "test-model"
    assert call_kwargs.kwargs["provider"] == "test-provider"
