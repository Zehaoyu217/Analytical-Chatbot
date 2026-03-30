from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from langchain_core.tools import BaseTool


@dataclass
class AgentCard:
    """A2A-inspired Agent Card describing a sub-agent's identity and capabilities."""

    name: str
    description: str
    system_prompt: str
    tools: list[BaseTool] = field(default_factory=list)
    skills: list[str] = field(default_factory=list)
    capabilities: dict[str, Any] = field(default_factory=lambda: {"streaming": True})


class AgentRegistry:
    """Registry for discovering and accessing sub-agents by name."""

    def __init__(self) -> None:
        self._agents: dict[str, AgentCard] = {}

    def register(self, card: AgentCard) -> None:
        self._agents[card.name] = card

    def get(self, name: str) -> AgentCard | None:
        return self._agents.get(name)

    def list_agents(self) -> list[dict[str, str]]:
        return [
            {"name": c.name, "description": c.description, "skills": ", ".join(c.skills)}
            for c in self._agents.values()
        ]

    def get_catalog_prompt(self) -> str:
        """Generate a prompt section listing all available sub-agents for the orchestrator."""
        if not self._agents:
            return ""
        lines = ["## Available Sub-Agents", ""]
        for card in self._agents.values():
            lines.append(f"- **{card.name}**: {card.description}")
            if card.skills:
                lines.append(f"  Skills: {', '.join(card.skills)}")
        return "\n".join(lines)


_registry: AgentRegistry | None = None


def get_agent_registry() -> AgentRegistry:
    global _registry
    if _registry is None:
        _registry = AgentRegistry()
    return _registry
