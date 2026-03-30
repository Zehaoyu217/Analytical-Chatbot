from __future__ import annotations

import logging
import shutil
import time
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_config
from app.api.router import api_router
from app.data.duckdb_manager import get_duckdb

logger = logging.getLogger(__name__)

MAX_AGE_DAYS = 3


def _cleanup_old_files(directory: str | Path, max_age_days: int = MAX_AGE_DAYS) -> int:
    """Delete subdirectories/files older than max_age_days. Returns count removed."""
    directory = Path(directory)
    if not directory.exists():
        return 0
    cutoff = time.time() - (max_age_days * 86400)
    removed = 0
    for item in directory.iterdir():
        try:
            mtime = item.stat().st_mtime
            if mtime < cutoff:
                if item.is_dir():
                    shutil.rmtree(item)
                else:
                    item.unlink()
                removed += 1
        except Exception:
            pass
    return removed


@asynccontextmanager
async def lifespan(app: FastAPI):
    cfg = get_config()
    # Ensure upload directory exists
    Path(cfg.data.upload_dir).mkdir(parents=True, exist_ok=True)

    # Clean up old traces and session files (>3 days)
    traces_dir = Path(__file__).parent.parent / "traces"
    removed = _cleanup_old_files(traces_dir)
    if removed:
        logger.info("Cleaned up %d old trace folders (>%d days)", removed, MAX_AGE_DAYS)

    # Initialize DuckDB
    db = get_duckdb()
    db.initialize()

    # Initialize deep agent (builds deepagents graph with tools + sub-agents)
    from app.agent.deep_agent import get_deep_agent
    get_deep_agent()

    yield

    # Cleanup
    db.close()


def create_app() -> FastAPI:
    cfg = get_config()

    app = FastAPI(
        title="Analytical Chatbot",
        version="0.1.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=cfg.server.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router, prefix="/api")

    return app


app = create_app()
