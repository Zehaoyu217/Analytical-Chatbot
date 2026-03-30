from __future__ import annotations

import logging
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_ollama import ChatOllama

from app.events.bus import AgentEvent

logger = logging.getLogger(__name__)


async def stream_polished_subagent(raw_text: str, session_id: str, bus: Any, agent_name: str) -> None:
    """Stream a polished version of the subagent's raw text to the UI.
    
    Uses a fast local Ollama model to format the text in real-time.
    """
    try:
        # Let the UI know a sub-agent is talking
        await bus.emit(session_id, AgentEvent(
            type="subagent_update_start",
            data={"agent_name": agent_name},
            agent_id=agent_name
        ))

        # Local Qwen polisher
        llm = ChatOllama(model="qwen3.5:9b", temperature=0.3)
        
        system_prompt = (
            "You are an executive formatting assistant. Rewrite the following raw "
            "text from an internal AI data analyst into a clean, polished, "
            "professional summary for a stakeholder. Use clear language and bullet points "
            "if appropriate. DO NOT add any new facts, do not make assumptions, and do not "
            "answer the question yourself. ONLY rewrite and format the provided text."
        )

        async for chunk in llm.astream([
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"Raw Analyst Text:\n{raw_text}")
        ]):
            if chunk.content:
                await bus.emit(session_id, AgentEvent(
                    type="subagent_update_delta",
                    data={"delta": chunk.content},
                    agent_id=agent_name
                ))

        # Signal completion
        await bus.emit(session_id, AgentEvent(
            type="subagent_update_done",
            data={},
            agent_id=agent_name
        ))

    except Exception as e:
        logger.error("Failed to polish subagent text (%s): %s", agent_name, e)
