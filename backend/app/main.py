from __future__ import annotations

import asyncio
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


def _prewarm_sandbox() -> None:
    """Run a dummy sandbox subprocess to populate OS page cache with heavy libraries.

    This doesn't keep a process alive (the sandbox spawns fresh subprocesses each time),
    but after this call the OS page cache has pandas/numpy/altair/duckdb shared libraries
    hot, so subsequent subprocess starts pay ~0 disk I/O for imports.
    """
    import subprocess
    import sys

    from app.sandbox.executor import _sandbox_env

    prewarm_code = (
        "import pandas, numpy, altair, duckdb, matplotlib, scipy, io, json\n"
        "print('sandbox-prewarm-ok')\n"
    )
    try:
        t0 = time.monotonic()
        result = subprocess.run(
            [sys.executable, "-c", prewarm_code],
            capture_output=True,
            text=True,
            timeout=30,
            env=_sandbox_env(),
        )
        elapsed = time.monotonic() - t0
        if result.returncode == 0 and "sandbox-prewarm-ok" in result.stdout:
            logger.info("Sandbox pre-warm completed in %.1fs (page cache hot)", elapsed)
        else:
            logger.warning(
                "Sandbox pre-warm finished with issues (rc=%d): %s",
                result.returncode,
                (result.stderr or result.stdout)[:200],
            )
    except Exception as e:
        logger.warning("Sandbox pre-warm failed (non-fatal): %s", e)


async def _prewarm_ollama() -> None:
    """Send a tiny completion to Ollama to force model loading into GPU memory.

    Only runs if the configured provider is 'ollama'. Runs as a background task
    so it doesn't block server startup.
    """
    cfg = get_config()
    if cfg.llm.provider != "ollama":
        return

    logger.info(
        "Ollama pre-warm: loading model '%s' into GPU memory...", cfg.llm.model
    )
    try:
        from app.llm.provider import create_chat_model
        from langchain_core.messages import HumanMessage

        llm = create_chat_model(max_tokens=1, temperature=0)
        t0 = time.monotonic()
        await llm.ainvoke([HumanMessage(content="hi")])
        elapsed = time.monotonic() - t0
        logger.info("Ollama pre-warm completed in %.1fs — model ready", elapsed)
    except Exception as e:
        logger.warning("Ollama pre-warm failed (non-fatal): %s", e)


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

    # Pre-warm: sandbox (sync, in thread) and Ollama model (async) in parallel
    loop = asyncio.get_running_loop()
    sandbox_task = loop.run_in_executor(None, _prewarm_sandbox)
    ollama_task = asyncio.create_task(_prewarm_ollama())

    # Fire-and-forget: don't block startup, but log when done
    async def _await_prewarm():
        try:
            await sandbox_task
        except Exception as e:
            logger.warning("Sandbox pre-warm background error: %s", e)
        try:
            await ollama_task
        except Exception as e:
            logger.warning("Ollama pre-warm background error: %s", e)

    asyncio.create_task(_await_prewarm())

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
