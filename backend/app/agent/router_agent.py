import json
import logging
from typing import Any

from pydantic import BaseModel, Field

from app.data.catalog import get_catalog
from app.llm.provider import get_chat_model
from app.events.bus import EventBus, AgentEvent

logger = logging.getLogger(__name__)

class RouterOutput(BaseModel):
    relevant_datasets: list[str] = Field(
        description="List of dataset names (table names) that are strictly relevant to the user's query."
    )
    reasoning: str = Field(
        description="A short explanation of why these datasets were selected."
    )

async def route_query(message: str, model_name: str, provider_name: str, session_id: str, bus: EventBus) -> list[str]:
    """Determine which datasets are relevant to the user query to save prompt context."""
    catalog = get_catalog()
    datasets = catalog.list_datasets()
    if not datasets:
        return []

    available_tables = [ds["table_name"] for ds in datasets]
    
    # If there are 3 or fewer tables, just return them all to save latency
    if len(available_tables) <= 3:
        return available_tables

    tables_str = ", ".join(available_tables)
    
    prompt = f"""You are a data routing assistant.
The user is asking an analytical question.
Available datasets (tables): {tables_str}

User Query: "{message}"

Analyze the query and determine which of the available datasets are required to answer it.
If the query is general and doesn't need data, return an empty list.
"""

    llm = get_chat_model(model_name, provider_name, temperature=0.0)
    
    # Notify UI that router is thinking
    await bus.emit(session_id, AgentEvent(
        type="progress",
        data={
            "id": "router",
            "label": "Analyzing query requirements...",
            "status": "running",
            "detail": "",
            "started_at": None,
            "finished_at": None,
        },
        agent_id="orchestrator"
    ))

    try:
        # Use structured output for reliable JSON
        router_llm = llm.with_structured_output(RouterOutput)
        result: RouterOutput = await router_llm.ainvoke(prompt)
        
        selected = [t for t in result.relevant_datasets if t in available_tables]
        
        detail_msg = f"Selected datasets: {', '.join(selected)}" if selected else "No specific datasets required."
        
        await bus.emit(session_id, AgentEvent(
            type="progress",
            data={
                "id": "router",
                "label": "Analyzing query requirements...",
                "status": "done",
                "detail": detail_msg,
                "started_at": None,
                "finished_at": None,
            },
            agent_id="orchestrator"
        ))
        
        return selected

    except Exception as e:
        logger.warning(f"Router LLM failed: {e}. Falling back to all datasets.")
        await bus.emit(session_id, AgentEvent(
            type="progress",
            data={
                "id": "router",
                "label": "Analyzing query requirements...",
                "status": "done",
                "detail": "Failed to route, including all datasets.",
                "started_at": None,
                "finished_at": None,
            },
            agent_id="orchestrator"
        ))
        return available_tables
