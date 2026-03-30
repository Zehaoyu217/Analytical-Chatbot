from __future__ import annotations

from langchain_core.tools import tool

from app.skills.registry import get_skill_registry


@tool
def load_skill(skill_name: str) -> str:
    """Load a skill's detailed instructions by name.

    Use this to get step-by-step guidance for specific analytical tasks.
    For sub-skills, use the path format: "skill_name/sub_skill_name".

    Examples:
        load_skill("visualization")                       # Main visualization skill
        load_skill("visualization/interactive_charts")     # Sub-skill for interactive charts
        load_skill("visualization/styled_theme")           # Sub-skill for chart theming
        load_skill("sql_analysis")                         # SQL analysis skill

    Args:
        skill_name: Skill name or path (e.g., "visualization" or "visualization/styled_theme").
    """
    registry = get_skill_registry()
    skill = registry.get_skill(skill_name)
    if not skill:
        available = registry.list_skills()
        catalog = []
        for s in available:
            catalog.append(s["path"])
            for sub in s.get("sub_skills", []):
                catalog.append(sub["path"])
        return f"Skill '{skill_name}' not found. Available: {catalog}"
    return f"# {skill['name']}\n{skill['description']}\n\n{skill['content']}"
