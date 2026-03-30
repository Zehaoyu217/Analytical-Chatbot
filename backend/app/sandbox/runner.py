"""Template script executed in the sandbox subprocess.

This module is written to a temp file and executed in a subprocess.
It captures stdout, stderr, and any generated figures.
"""

RUNNER_TEMPLATE = '''
import sys
import json
import io
import os
import base64

# Redirect stdout/stderr
_stdout_buf = io.StringIO()
_stderr_buf = io.StringIO()
sys.stdout = _stdout_buf
sys.stderr = _stderr_buf

_result = {"stdout": "", "stderr": "", "figures": [], "charts": [], "tables_html": [], "diagrams": [], "return_value": None, "error": None}

def print_full(obj, max_rows=200):
    """Print a DataFrame or object without truncation so the agent can fully see results."""
    import pandas as pd
    if isinstance(obj, pd.DataFrame):
        with pd.option_context("display.max_rows", max_rows, "display.max_columns", None, "display.width", None):
            print(obj.to_string())
    else:
        print(obj)

def save_table_html(df, title=""):
    """Save a pandas DataFrame as HTML for the Artifacts panel."""
    html = df.to_html(classes="artifact-table", index=False, max_rows=200)
    if title:
        html = f"<h3>{title}</h3>" + html
    _result["tables_html"].append({"title": title, "html": html})

def save_chart_vegalite(chart, title=""):
    """Save an Altair chart as Vega-Lite JSON for the Artifacts panel."""
    spec = chart.to_json()
    _result["charts"].append({"title": title, "spec": spec})

def save_mermaid(code, title="Diagram"):
    """Save a Mermaid diagram for the Artifacts panel."""
    _result["diagrams"].append({"title": title, "code": code})

def styled_chart(base_chart, title="", width=560, height=320):
    """Apply premium financial dark theme to any Altair chart."""
    import altair as alt
    return base_chart.properties(
        title=alt.Title(title, fontSize=14, fontWeight=600, color='#f1f3f9', anchor='start', offset=10),
        width=width, height=height,
    ).configure(
        background='transparent', font='Inter',
    ).configure_axis(
        labelColor='#9da3b4', titleColor='#9da3b4',
        gridColor='rgba(255,255,255,0.04)', domainColor='rgba(255,255,255,0.1)',
        labelFontSize=11, titleFontSize=12, labelFont='Inter', titleFont='Inter',
        tickColor='rgba(255,255,255,0.1)',
    ).configure_legend(
        labelColor='#9da3b4', titleColor='#f1f3f9',
        labelFontSize=11, titleFontSize=12, labelFont='Inter', titleFont='Inter',
        orient='bottom', padding=10,
    ).configure_view(strokeWidth=0)

try:
    # Set matplotlib to non-interactive backend
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    # DuckDB: copy the database file to a temp location to avoid lock conflicts
    # with the backend process (DuckDB uses single-writer locking).
    import duckdb
    import shutil
    import tempfile
    _db_source = "__DUCKDB_PATH__"
    _db_tmp = None
    try:
        _db_tmp_fd = tempfile.NamedTemporaryFile(suffix=".duckdb", delete=False)
        _db_tmp = _db_tmp_fd.name
        _db_tmp_fd.close()
        shutil.copy2(_db_source, _db_tmp)
        # Also copy WAL file if it exists
        _wal = _db_source + ".wal"
        if os.path.exists(_wal):
            shutil.copy2(_wal, _db_tmp + ".wal")
        _db = duckdb.connect(_db_tmp, read_only=True)
    except Exception as _copy_err:
        print(f"Warning: Could not copy DuckDB: {_copy_err}", file=sys.stderr)
        _db = duckdb.connect()  # fallback: empty in-memory

    # Execute user code
__USER_CODE__

    # Capture any matplotlib figures
    for fig_num in plt.get_fignums():
        fig = plt.figure(fig_num)
        buf = io.BytesIO()
        fig.savefig(buf, format="png", dpi=150, bbox_inches="tight")
        buf.seek(0)
        _result["figures"].append(base64.b64encode(buf.read()).decode("utf-8"))
        plt.close(fig)

except Exception as _e:
    _result["error"] = f"{type(_e).__name__}: {_e}"

finally:
    sys.stdout = sys.__stdout__
    sys.stderr = sys.__stderr__
    _result["stdout"] = _stdout_buf.getvalue()
    _result["stderr"] = _stderr_buf.getvalue()
    try:
        _db.close()
    except Exception:
        pass
    # Clean up temp DuckDB copy
    if _db_tmp:
        try:
            os.unlink(_db_tmp)
            _wal_tmp = _db_tmp + ".wal"
            if os.path.exists(_wal_tmp):
                os.unlink(_wal_tmp)
        except Exception:
            pass

print("__SANDBOX_RESULT__")
print(json.dumps(_result))
'''
