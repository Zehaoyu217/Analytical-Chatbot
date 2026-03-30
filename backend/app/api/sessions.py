from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.agent.graph import get_agent

router = APIRouter()


@router.get("/sessions")
async def list_sessions():
    """List sessions — with InMemorySaver, returns sessions from current process."""
    agent = get_agent()
    checkpointer = agent.checkpointer
    try:
        # InMemorySaver stores data in .storage dict keyed by (thread_id, ...)
        thread_ids = set()
        for key in checkpointer.storage:
            if isinstance(key, tuple) and len(key) > 0:
                thread_ids.add(key[0])
        return {"sessions": [{"id": tid} for tid in sorted(thread_ids)]}
    except Exception:
        return {"sessions": []}


@router.get("/sessions/{session_id}")
async def get_session(session_id: str):
    agent = get_agent()
    checkpointer = agent.checkpointer
    try:
        config = {"configurable": {"thread_id": session_id}}
        state = await checkpointer.aget(config)
        if not state:
            raise HTTPException(404, "Session not found")
        messages = state.get("channel_values", {}).get("messages", [])
        return {
            "session_id": session_id,
            "messages": [
                {"role": getattr(m, "type", "unknown"), "content": getattr(m, "content", str(m))}
                for m in messages
            ],
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))
