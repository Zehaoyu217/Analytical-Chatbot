from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, HTTPException

from app.config import get_config
from app.data.ingest import ingest_file

router = APIRouter()

ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls", ".tsv", ".parquet"}


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    cfg = get_config()
    ext = Path(file.filename or "").suffix.lower()

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"Unsupported file type: {ext}. Allowed: {ALLOWED_EXTENSIONS}")

    # Check file size
    contents = await file.read()
    max_bytes = cfg.data.max_upload_size_mb * 1024 * 1024
    if len(contents) > max_bytes:
        raise HTTPException(400, f"File exceeds {cfg.data.max_upload_size_mb}MB limit")

    # Save to upload directory
    file_id = str(uuid.uuid4())[:8]
    safe_name = Path(file.filename or "upload").stem
    # Sanitize: keep only alphanumeric and underscores
    table_name = "".join(c if c.isalnum() or c == "_" else "_" for c in safe_name).lower()
    table_name = f"{table_name}_{file_id}"

    upload_path = Path(cfg.data.upload_dir) / f"{table_name}{ext}"
    upload_path.write_bytes(contents)

    # Ingest into DuckDB
    result = ingest_file(upload_path, table_name)

    # Invalidate agent cache so new data context is reflected in system prompts
    from app.agent.deep_agent import invalidate_agent_cache
    invalidate_agent_cache()

    return {
        "table_name": table_name,
        "file_name": file.filename,
        "rows": result["rows"],
        "columns": result["columns"],
        "schema": result["schema"],
    }
