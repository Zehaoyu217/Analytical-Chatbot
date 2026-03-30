from __future__ import annotations

from langchain_core.tools import tool

from app.data.catalog import get_catalog


@tool
def list_datasets() -> str:
    """List all available datasets in the database. Returns table names with row counts and column info."""
    catalog = get_catalog()
    datasets = catalog.list_datasets()
    if not datasets:
        return "No datasets available. Upload a CSV or Excel file first."

    lines = ["Available datasets:"]
    for ds in datasets:
        lines.append(f"  - {ds['table_name']}: {ds['row_count']} rows, {ds['column_count']} columns")
    return "\n".join(lines)
