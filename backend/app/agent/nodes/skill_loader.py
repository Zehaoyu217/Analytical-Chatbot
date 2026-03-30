from __future__ import annotations

from langchain_core.runnables import RunnableConfig
from langgraph.types import Command

from app.agent.state import AgentState
from app.skills.registry import get_skill_registry


async def skill_loader_node(state: AgentState, config: RunnableConfig) -> Command:
    """Load the selected skill's full content into agent state."""
    registry = get_skill_registry()

    skill_name = state.selected_skill
    if not skill_name:
        return Command(goto="executor", update={"skill_content": None})

    skill = registry.get_skill(skill_name)
    if skill:
        content = skill["content"]
    else:
        content = None

    return Command(goto="executor", update={"skill_content": content})
