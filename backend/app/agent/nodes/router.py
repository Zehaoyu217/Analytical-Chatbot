from __future__ import annotations

import re

from langchain_core.runnables import RunnableConfig
from langgraph.types import Command

from app.agent.state import AgentState
from app.skills.registry import get_skill_registry


# Fast keyword-based routing — no LLM call needed
SKILL_KEYWORDS: dict[str, list[str]] = {
    "sql_analysis": ["query", "sql", "filter", "aggregate", "join", "count", "average", "sum",
                      "group by", "where", "select", "top", "first", "rows", "show me", "how many",
                      "which", "list", "find", "sort", "order by", "limit", "between",
                      "mean", "median", "std", "standard deviation", "min", "max", "calculate"],
    "data_profiling": ["describe", "profile", "summary", "overview", "statistics", "stats",
                       "info", "shape", "columns", "schema", "data types", "null", "missing",
                       "what data", "what dataset", "what table"],
    "visualization": ["chart", "plot", "graph", "histogram", "scatter", "bar chart", "line chart",
                       "visualize", "visualization", "heatmap", "distribution", "pie chart", "draw"],
    "statistical_test": ["correlation", "regression", "hypothesis", "t-test", "chi-square",
                          "anova", "p-value", "significance", "statistical", "test"],
    "trend_analysis": ["trend", "time series", "forecast", "seasonal", "growth", "decline",
                        "over time", "monthly", "yearly", "quarterly", "period"],
    "data_cleaning": ["clean", "fix", "remove duplicates", "fill missing", "transform",
                       "rename", "drop", "convert", "normalize", "standardize"],
    "research_report": ["report", "comprehensive", "analysis report", "deep dive", "investigate",
                         "research", "write up", "detailed analysis"],
    "dashboard": ["dashboard", "metric card", "kpi", "metrics", "build a dashboard"],
}


def _route_by_keywords(message: str) -> str | None:
    """Fast keyword-based routing. Returns skill name or None for general."""
    msg_lower = message.lower()
    scores: dict[str, int] = {}

    for skill, keywords in SKILL_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in msg_lower)
        if score > 0:
            scores[skill] = score

    if not scores:
        return None

    return max(scores, key=scores.get)


async def router_node(state: AgentState, config: RunnableConfig) -> Command:
    """Route the user's message to the appropriate skill using fast keyword matching."""
    last_message = state.messages[-1]
    content = getattr(last_message, "content", str(last_message))

    skill_name = _route_by_keywords(content)

    # Verify the skill actually exists
    if skill_name:
        registry = get_skill_registry()
        skill = registry.get_skill(skill_name)
        if not skill:
            skill_name = None

    if not skill_name:
        return Command(goto="executor", update={"selected_skill": None, "skill_content": None})

    return Command(goto="skill_loader", update={"selected_skill": skill_name})
