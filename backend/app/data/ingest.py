from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from app.data.duckdb_manager import get_duckdb


def ingest_file(file_path: Path, table_name: str) -> dict[str, Any]:
    """Ingest a CSV/Excel/Parquet file into DuckDB and register in catalog."""
    db = get_duckdb()
    ext = file_path.suffix.lower()

    # Build the CREATE TABLE statement based on file type
    if ext == ".csv" or ext == ".tsv":
        db.execute(
            f"CREATE OR REPLACE TABLE \"{table_name}\" AS "
            f"SELECT * FROM read_csv_auto('{file_path}', header=true)"
        )
    elif ext in (".xlsx", ".xls"):
        # DuckDB spatial extension provides st_read for Excel
        # Alternatively use pandas as fallback
        try:
            db.execute(
                f"CREATE OR REPLACE TABLE \"{table_name}\" AS "
                f"SELECT * FROM st_read('{file_path}')"
            )
        except Exception:
            # Fallback: use pandas + openpyxl
            import pandas as pd
            df = pd.read_excel(file_path)
            import duckdb as _duckdb
            conn = _duckdb.connect(db._db_path)
            conn.execute(
                f"CREATE OR REPLACE TABLE \"{table_name}\" AS SELECT * FROM df"
            )
            conn.close()
    elif ext == ".parquet":
        db.execute(
            f"CREATE OR REPLACE TABLE \"{table_name}\" AS "
            f"SELECT * FROM read_parquet('{file_path}')"
        )
    else:
        raise ValueError(f"Unsupported file type: {ext}")

    # Get metadata
    schema = db.get_table_schema(table_name)
    row_count = db.execute_query(f'SELECT count(*) as cnt FROM "{table_name}"')[0]["cnt"]

    # Register in catalog
    db.execute(
        """
        INSERT OR REPLACE INTO _datasets_catalog
        (table_name, file_name, file_path, row_count, column_count, schema_json)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        [table_name, file_path.name, str(file_path), row_count, len(schema), json.dumps(schema)],
    )

    return {
        "table_name": table_name,
        "rows": row_count,
        "columns": len(schema),
        "schema": schema,
    }
