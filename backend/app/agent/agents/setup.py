from __future__ import annotations

import logging
from pathlib import Path

from app.agent.agents.registry import AgentCard, get_agent_registry
from app.agent.tools.list_datasets import list_datasets
from app.agent.tools.get_schema import get_schema
from app.agent.tools.query_duckdb import query_duckdb
from app.agent.tools.run_python import run_python
from app.agent.tools.save_artifact import save_artifact, save_dashboard_component

logger = logging.getLogger(__name__)

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


def _load_prompt(filename: str) -> str:
    path = PROMPTS_DIR / filename
    if path.exists():
        return path.read_text()
    logger.warning("Sub-agent prompt not found: %s", path)
    return "You are a helpful data analysis assistant."


def register_agents() -> None:
    """Register all sub-agents at startup."""
    registry = get_agent_registry()

    registry.register(AgentCard(
        name="data_profiler",
        description="Dataset profiling, statistics, data quality analysis, null detection, distributions",
        system_prompt=_load_prompt("data_profiler_prompt.md"),
        tools=[list_datasets, get_schema, query_duckdb, run_python, save_artifact],
        skills=["profiling", "statistics", "data-quality", "EDA"],
    ))

    registry.register(AgentCard(
        name="sql_analyst",
        description="Complex SQL queries, aggregations, joins, window functions, CTEs",
        system_prompt=_load_prompt("sql_analyst_prompt.md"),
        tools=[list_datasets, get_schema, query_duckdb, save_artifact],
        skills=["sql", "aggregation", "filtering", "joins"],
    ))

    registry.register(AgentCard(
        name="visualizer",
        description="Charts, plots, dashboards, visual data representations using Altair/Vega-Lite",
        system_prompt=_load_prompt("visualizer_prompt.md"),
        tools=[query_duckdb, run_python, save_artifact, save_dashboard_component],
        skills=["charts", "visualization", "dashboard", "altair"],
    ))

    registry.register(AgentCard(
        name="researcher",
        description="Multi-step research and analysis, comprehensive reports, deep investigation",
        system_prompt=_load_prompt("researcher_prompt.md"),
        tools=[list_datasets, get_schema, query_duckdb, run_python, save_artifact],
        skills=["research", "report", "deep-analysis", "investigation"],
    ))

    logger.info("Registered %d sub-agents", len(registry.list_agents()))
