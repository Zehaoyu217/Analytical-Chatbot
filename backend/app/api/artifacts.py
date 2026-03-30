from __future__ import annotations

from fastapi import APIRouter

from app.artifacts.store import get_artifact_store

router = APIRouter()


@router.get("/sessions/{session_id}/artifacts")
async def get_artifacts(session_id: str):
    store = get_artifact_store()
    artifacts = store.get_artifacts(session_id)
    return {"artifacts": [a.model_dump() for a in artifacts]}


@router.get("/sessions/{session_id}/progress")
async def get_progress(session_id: str):
    store = get_artifact_store()
    steps = store.get_progress(session_id)
    return {"steps": [s.model_dump() for s in steps]}


@router.get("/sessions/{session_id}/dashboard")
async def get_dashboard(session_id: str):
    store = get_artifact_store()
    components = store.get_dashboard(session_id)
    return {"components": components}
