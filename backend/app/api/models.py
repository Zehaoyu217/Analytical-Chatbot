from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from app.config import get_config
from app.llm.registry import get_model_registry

router = APIRouter()


class SetActiveModelRequest(BaseModel):
    provider: str
    model: str


@router.get("/models")
async def list_models():
    registry = get_model_registry()
    config = get_config()
    return {
        "models": registry.list_models(),
        "active": {
            "provider": config.llm.provider,
            "model": config.llm.model,
        },
    }


@router.put("/models/active")
async def set_active_model(request: SetActiveModelRequest):
    config = get_config()
    config.llm.provider = request.provider
    config.llm.model = request.model
    return {"provider": request.provider, "model": request.model}
