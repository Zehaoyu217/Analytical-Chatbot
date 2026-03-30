from __future__ import annotations

from langchain_core.tools import tool

from app.skills.registry import get_skill_registry

# Parent skills whose full content should be suppressed when a sub-skill
# is available — keeps context lean for small models.
_PARENT_SKILLS_WITH_SUBS = {"altair_charts"}


@tool
def load_skill(skill_name: str) -> str:
    """Load a skill's detailed instructions by name.

    For charts, load the specific sub-skill directly — e.g. `altair_charts/bar_chart`,
    NOT the parent `altair_charts`. The sub-skill contains everything you need.

    Examples:
        load_skill("altair_charts/bar_chart")           # bar chart templates
        load_skill("altair_charts/line_chart")          # time series templates
        load_skill("altair_charts/scatter_chart")       # scatter + regression
        load_skill("altair_charts/donut_chart")         # donut (never pie)
        load_skill("altair_charts/distribution")        # histogram, KDE, box plot
        load_skill("altair_charts/advanced")            # reference lines, grouped bar, heatmap
        load_skill("mermaid")                           # Diagram templates
        load_skill("dashboard")                         # A2UI dashboard components

    Args:
        skill_name: Skill path — "parent/child" for chart sub-skills, or top-level name.
    """
    registry = get_skill_registry()

    # If loading a parent skill that has sub-skills, redirect to a short summary
    # so the model doesn't waste context on the full design system doc.
    if skill_name in _PARENT_SKILLS_WITH_SUBS:
        return (
            f"Skill '{skill_name}' is a parent skill — load the specific sub-skill instead.\n"
            f"Pick one: altair_charts/bar_chart, altair_charts/line_chart, "
            f"altair_charts/scatter_chart, altair_charts/donut_chart, "
            f"altair_charts/distribution, altair_charts/advanced.\n"
            f"If you already loaded a sub-skill, proceed to `run_python` now."
        )

    skill = registry.get_skill(skill_name)
    if not skill:
        available = registry.list_skills()
        catalog = []
        for s in available:
            catalog.append(s["path"])
            for sub in s.get("sub_skills", []):
                catalog.append(sub["path"])
        return f"Skill '{skill_name}' not found. Available: {catalog}"
    content = f"# {skill['name']}\n{skill['description']}\n\n{skill['content']}"

    # For chart/diagram sub-skills, append a continuation directive so the model
    # doesn't stop after reading the template — it must call run_python next.
    chart_sub_skills = {
        "bar_chart", "line_chart", "donut_chart", "scatter_chart",
        "distribution", "advanced", "mermaid",
    }
    leaf = skill_name.rsplit("/", 1)[-1] if "/" in skill_name else skill_name
    if leaf in chart_sub_skills:
        content += (
            "\n\n---\n**YOU ARE NOT DONE.** The user asked for a CHART, not a table. "
            "You MUST call `run_python` NOW with a script that queries the data AND draws the chart. "
            "Follow the template above exactly. Pre-imported: `gs_theme`, `save_artifact`, "
            "`PRIMARY`, `CAT_PALETTE`, `_db`. Use `:Q` for numbers, `:N` for categories, `:T` for dates only."
        )

    return content
