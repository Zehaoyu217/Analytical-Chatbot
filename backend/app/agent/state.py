from __future__ import annotations

from typing import Annotated, Any

from langgraph.graph.message import add_messages
from pydantic import BaseModel, Field
from langchain_core.messages import BaseMessage


class AgentState(BaseModel):
    """Typed state for the LangGraph agent."""

    messages: Annotated[list[BaseMessage], add_messages] = Field(default_factory=list)

    # Skill routing
    selected_skill: str | None = None
    skill_content: str | None = None

    # Tool/execution results
    sandbox_result: dict[str, Any] | None = None

    # Dataset context
    available_datasets: list[str] = Field(default_factory=list)

    # Response accumulator
    response_chunks: list[str] = Field(default_factory=list)

    # Tool execution log for progress visibility
    tool_calls_log: list[dict[str, Any]] = Field(default_factory=list)

    class Config:
        arbitrary_types_allowed = True
