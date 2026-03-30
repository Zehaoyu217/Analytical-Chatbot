from __future__ import annotations

import json
from typing import Any

from app.data.duckdb_manager import get_duckdb


class DataCatalog:
    """Manages dataset metadata from the _datasets_catalog table."""

    def list_datasets(self) -> list[dict[str, Any]]:
        db = get_duckdb()
        try:
            rows = db.execute_query(
                "SELECT table_name, file_name, row_count, column_count, created_at "
                "FROM _datasets_catalog ORDER BY created_at DESC"
            )
            return rows
        except Exception:
            return []

    def get_dataset(self, table_name: str) -> dict[str, Any] | None:
        db = get_duckdb()
        rows = db.execute_query(
            "SELECT * FROM _datasets_catalog WHERE table_name = ?", [table_name]
        )
        if not rows:
            return None
        ds = rows[0]
        ds["schema"] = json.loads(ds.get("schema_json", "[]"))
        return ds

    def remove_dataset(self, table_name: str) -> None:
        db = get_duckdb()
        db.execute("DELETE FROM _datasets_catalog WHERE table_name = ?", [table_name])


_catalog: DataCatalog | None = None


def get_catalog() -> DataCatalog:
    global _catalog
    if _catalog is None:
        _catalog = DataCatalog()
    return _catalog
