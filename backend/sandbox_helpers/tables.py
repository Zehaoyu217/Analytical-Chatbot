"""Enterprise HTML table builder for the OneGS theme.

Auto-imported into every run_python sandbox call.
"""
from __future__ import annotations


def styled_table_html(df, title: str = "") -> str:
    """Build an enterprise-grade HTML table string with OneGS dark styling.

    Returns an HTML string. Pass it to save_artifact() to display it.

    Args:
        df:    pandas DataFrame
        title: Optional section title rendered above the table

    Example:
        df = _db.execute("SELECT * FROM my_table LIMIT 20").df()
        html = styled_table_html(df, "Latest Results")
        save_artifact(html, "Latest Results")
    """
    header_cells = "".join(
        f'<th style="padding:7px 14px;background:#1a2038;'
        f'border-bottom:1px solid rgba(255,255,255,0.11);color:#8494ad;font-size:10px;font-weight:700;'
        f'letter-spacing:0.6px;text-transform:uppercase;white-space:nowrap;text-align:left;">{col}</th>'
        for col in df.columns
    )

    rows_html = ""
    for i, (_, row) in enumerate(df.iterrows()):
        bg = "transparent" if i % 2 == 0 else "rgba(255,255,255,0.015)"
        cells = "".join(
            f'<td style="padding:6px 14px;border-bottom:1px solid rgba(255,255,255,0.06);'
            f'color:#e8ecf4;font-size:12px;font-family:\'IBM Plex Mono\',\'JetBrains Mono\',monospace;'
            f'font-variant-numeric:tabular-nums;">{v if v is not None else "<span style=\'color:#5c6278;font-style:italic\'>null</span>"}</td>'
            for v in row
        )
        rows_html += f'<tr style="background:{bg};">{cells}</tr>'

    title_block = (
        f'<div style="padding:8px 14px;font-size:10px;font-weight:700;font-family:\'IBM Plex Sans\',Inter,sans-serif;'
        f'color:#8494ad;letter-spacing:0.8px;text-transform:uppercase;'
        f'border-bottom:1px solid rgba(255,255,255,0.08);">{title}</div>'
        if title else ""
    )

    return (
        f'<div style="font-family:\'IBM Plex Sans\',Inter,sans-serif;border:1px solid rgba(255,255,255,0.08);'
        f'border-radius:6px;overflow:hidden;background:#12172b;">'
        f'{title_block}'
        f'<div style="overflow-x:auto;">'
        f'<table style="width:100%;border-collapse:collapse;text-align:left;">'
        f'<thead><tr>{header_cells}</tr></thead>'
        f'<tbody>{rows_html}</tbody>'
        f'</table></div></div>'
    )
