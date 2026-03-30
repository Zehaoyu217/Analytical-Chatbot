from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.data.catalog import get_catalog
from app.data.duckdb_manager import get_duckdb

router = APIRouter()


@router.get("/datasets")
async def list_datasets():
    catalog = get_catalog()
    return {"datasets": catalog.list_datasets()}


@router.get("/datasets/{table_name}/schema")
async def get_schema(table_name: str):
    catalog = get_catalog()
    ds = catalog.get_dataset(table_name)
    if not ds:
        raise HTTPException(404, f"Dataset '{table_name}' not found")
    return ds


@router.get("/datasets/{table_name}/preview")
async def preview_dataset(table_name: str, limit: int = 10):
    db = get_duckdb()
    catalog = get_catalog()

    ds = catalog.get_dataset(table_name)
    if not ds:
        raise HTTPException(404, f"Dataset '{table_name}' not found")

    rows = db.execute_query(f'SELECT * FROM "{table_name}" LIMIT {int(limit)}')
    return {"table_name": table_name, "rows": rows}


@router.delete("/datasets/{table_name}")
async def delete_dataset(table_name: str):
    catalog = get_catalog()
    db = get_duckdb()

    ds = catalog.get_dataset(table_name)
    if not ds:
        raise HTTPException(404, f"Dataset '{table_name}' not found")

    db.execute(f'DROP TABLE IF EXISTS "{table_name}"')
    catalog.remove_dataset(table_name)

    from app.agent.deep_agent import invalidate_agent_cache
    invalidate_agent_cache()

    return {"status": "deleted", "table_name": table_name}
