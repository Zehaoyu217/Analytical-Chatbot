from __future__ import annotations

from app.agent.agents.registry import AgentCard, AgentRegistry


def test_register_and_get(agent_registry: AgentRegistry, sample_agent_card: AgentCard):
    agent_registry.register(sample_agent_card)
    result = agent_registry.get("test_agent")
    assert result is not None
    assert result.name == "test_agent"
    assert result.description == "A test agent for unit testing"


def test_get_unknown_returns_none(agent_registry: AgentRegistry):
    result = agent_registry.get("nonexistent")
    assert result is None


def test_list_agents(agent_registry: AgentRegistry, sample_agent_card: AgentCard):
    agent_registry.register(sample_agent_card)
    agents = agent_registry.list_agents()
    assert len(agents) == 1
    assert agents[0]["name"] == "test_agent"
    assert agents[0]["description"] == "A test agent for unit testing"
    assert "testing" in agents[0]["skills"]


def test_list_agents_multiple(agent_registry: AgentRegistry, sample_agent_card: AgentCard):
    agent_registry.register(sample_agent_card)
    agent_registry.register(AgentCard(
        name="second_agent",
        description="Another agent",
        system_prompt="You are another agent.",
        skills=["analysis"],
    ))
    agents = agent_registry.list_agents()
    assert len(agents) == 2
    names = {a["name"] for a in agents}
    assert names == {"test_agent", "second_agent"}


def test_get_catalog_prompt(agent_registry: AgentRegistry, sample_agent_card: AgentCard):
    agent_registry.register(sample_agent_card)
    prompt = agent_registry.get_catalog_prompt()
    assert "## Available Sub-Agents" in prompt
    assert "test_agent" in prompt
    assert "A test agent for unit testing" in prompt


def test_get_catalog_prompt_empty(agent_registry: AgentRegistry):
    prompt = agent_registry.get_catalog_prompt()
    assert prompt == ""


def test_register_overwrites(agent_registry: AgentRegistry, sample_agent_card: AgentCard):
    agent_registry.register(sample_agent_card)
    agent_registry.register(AgentCard(
        name="test_agent",
        description="Updated description",
        system_prompt="Updated prompt",
    ))
    result = agent_registry.get("test_agent")
    assert result.description == "Updated description"
    assert len(agent_registry.list_agents()) == 1
