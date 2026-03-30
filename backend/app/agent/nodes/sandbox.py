from __future__ import annotations

from typing import Any

from app.agent.state import AgentState
from app.sandbox.executor import execute_python


async def sandbox_node(state: AgentState, config: dict) -> dict[str, Any]:
    """Execute Python code in the sandbox. Used as a standalone node when needed."""
    # This node is available for direct sandbox execution if the graph
    # routes here explicitly. In normal flow, sandbox is called via
    # the run_python tool in the executor node.
    return {"sandbox_result": None}
