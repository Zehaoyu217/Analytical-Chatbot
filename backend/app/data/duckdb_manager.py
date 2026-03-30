from __future__ import annotations

import threading
from pathlib import Path
from typing import Any

import duckdb

from app.config import get_config


class DuckDBManager:
    """Manages DuckDB connection and query execution."""

    def __init__(self, db_path: str):
        self._db_path = db_path
        self._local = threading.local()

    @property
    def _conn(self) -> duckdb.DuckDBPyConnection:
        if not hasattr(self._local, "conn") or self._local.conn is None:
            Path(self._db_path).parent.mkdir(parents=True, exist_ok=True)
            self._local.conn = duckdb.connect(self._db_path)
        return self._local.conn

    def initialize(self) -> None:
        """Create metadata tables if they don't exist."""
        self._conn.execute("""
            CREATE TABLE IF NOT EXISTS _datasets_catalog (
                table_name VARCHAR PRIMARY KEY,
                file_name VARCHAR,
                file_path VARCHAR,
                row_count INTEGER,
                column_count INTEGER,
                schema_json VARCHAR,
                created_at TIMESTAMP DEFAULT current_timestamp
            )
        """)
        # Load excel extension for XLSX support
        try:
            self._conn.execute("INSTALL spatial; LOAD spatial;")
        except Exception:
            pass

    def execute(self, sql: str, params: list[Any] | None = None) -> None:
        if params:
            self._conn.execute(sql, params)
        else:
            self._conn.execute(sql)

    def execute_query(self, sql: str, params: list[Any] | None = None) -> list[dict[str, Any]]:
        """Execute a query and return results as list of dicts."""
        if params:
            result = self._conn.execute(sql, params)
        else:
            result = self._conn.execute(sql)

        columns = [desc[0] for desc in result.description]
        rows = result.fetchall()
        return [dict(zip(columns, row)) for row in rows]

    def execute_query_raw(self, sql: str) -> dict[str, Any]:
        """Execute a query and return columns + rows separately."""
        result = self._conn.execute(sql)
        columns = [desc[0] for desc in result.description]
        rows = [list(row) for row in result.fetchall()]
        return {"columns": columns, "rows": rows}

    def get_table_schema(self, table_name: str) -> list[dict[str, str]]:
        """Get column names and types for a table."""
        result = self._conn.execute(f"DESCRIBE \"{table_name}\"")
        return [
            {"name": row[0], "type": row[1], "nullable": row[2]}
            for row in result.fetchall()
        ]

    def table_exists(self, table_name: str) -> bool:
        result = self._conn.execute(
            "SELECT count(*) FROM information_schema.tables WHERE table_name = ?",
            [table_name],
        )
        return result.fetchone()[0] > 0

    def close(self) -> None:
        if hasattr(self._local, "conn") and self._local.conn:
            self._local.conn.close()
            self._local.conn = None


_instance: DuckDBManager | None = None


def get_duckdb() -> DuckDBManager:
    global _instance
    if _instance is None:
        cfg = get_config()
        _instance = DuckDBManager(cfg.data.duckdb_path)
    return _instance
