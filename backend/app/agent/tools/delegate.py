from __future__ import annotations

from langchain_core.tools import tool

from app.agent.context import current_session_id, current_model_config


@tool
async def delegate_to_agent(agent_name: str, task: str) -> str:
    """Delegate a task to a specialized sub-agent for deeper analysis.

    Use this when the task requires focused expertise. Each sub-agent has
    specialized prompts, tools, and domain knowledge.

    Available agents:
    - data_profiler: Dataset profiling, statistics, data quality, null analysis, distributions
    - sql_analyst: Complex SQL queries, aggregations, joins, window functions, CTEs
    - visualizer: Charts, plots, dashboards using Altair/Vega-Lite
    - researcher: Multi-step research, comprehensive reports, deep investigation

    Args:
        agent_name: Name of the sub-agent to delegate to.
        task: Clear, detailed task description. Include all relevant context
              (table names, column names, what you want to find out).
    """
    from app.agent.agents.registry import get_agent_registry
    from app.agent.agents.sub_agent import run_sub_agent

    registry = get_agent_registry()
    card = registry.get(agent_name)
    if not card:
        available = ", ".join(a["name"] for a in registry.list_agents())
        return f"Unknown agent '{agent_name}'. Available agents: {available}"

    session_id = current_session_id.get()
    model_config = current_model_config.get()

    result = await run_sub_agent(
        card=card,
        task=task,
        session_id=session_id,
        model=model_config.get("model"),
        provider=model_config.get("provider"),
    )
    return result
