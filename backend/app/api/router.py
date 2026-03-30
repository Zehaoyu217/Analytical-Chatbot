from fastapi import APIRouter

from app.api import chat, datasets, upload, models, sessions, artifacts

api_router = APIRouter()

api_router.include_router(chat.router, tags=["chat"])
api_router.include_router(upload.router, tags=["upload"])
api_router.include_router(datasets.router, tags=["datasets"])
api_router.include_router(models.router, tags=["models"])
api_router.include_router(sessions.router, tags=["sessions"])
api_router.include_router(artifacts.router, tags=["artifacts"])


@api_router.get("/health")
async def health():
    return {"status": "ok"}
