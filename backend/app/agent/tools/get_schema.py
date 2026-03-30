from __future__ import annotations

from langchain_core.tools import tool

from app.data.duckdb_manager import get_duckdb


@tool
def get_schema(table_name: str) -> str:
    """Get the column names, types, and sample values for a dataset table.

    Args:
        table_name: Name of the dataset table to inspect.
    """
    db = get_duckdb()

    if not db.table_exists(table_name):
        return f"Table '{table_name}' not found."

    schema = db.get_table_schema(table_name)
    lines = [f"Schema for '{table_name}':"]
    for col in schema:
        lines.append(f"  - {col['name']}: {col['type']} (nullable: {col['nullable']})")

    # Add sample values
    try:
        sample = db.execute_query(f'SELECT * FROM "{table_name}" LIMIT 3')
        if sample:
            lines.append("\nSample rows (first 3):")
            for i, row in enumerate(sample):
                lines.append(f"  Row {i+1}: {row}")
    except Exception:
        pass

    return "\n".join(lines)
