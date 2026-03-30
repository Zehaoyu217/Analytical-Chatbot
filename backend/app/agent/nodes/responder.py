from __future__ import annotations

from typing import Any

from langchain_core.runnables import RunnableConfig

from app.agent.state import AgentState


async def responder_node(state: AgentState, config: RunnableConfig) -> dict[str, Any]:
    """Format the final response. Currently a pass-through since the executor
    already produces the final AI message. This node exists as an extension
    point for post-processing (e.g., adding data tables, charts to response)."""
    return {}
