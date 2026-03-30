from __future__ import annotations

from app.agent.deep_agent import get_deep_agent


def get_agent():
    """Get the compiled deep agent graph.

    This now uses LangChain's deepagents SDK which provides:
    - Planning (write_todos/read_todos)
    - Auto-summarization (prevents context overflow)
    - Sub-agent delegation (task tool with isolated context)
    - Custom tools (query_duckdb, run_python, save_artifact, etc.)
    - EventBus middleware for real-time UI streaming
    """
    return get_deep_agent()
