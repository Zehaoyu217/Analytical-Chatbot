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

_result = {"stdout": "", "stderr": "", "figures": [], "charts": [], "tables_html": [], "diagrams": [], "inline_components": [], "artifact_updates": [], "return_value": None, "error": None}

# Auto-summarize DataFrames on print() so large tables don't flood the context window.
# Use print_full(df) when you actually need all rows.
_original_print = print
def print(*args, **kwargs):
    import pandas as _pd
    if len(args) == 1 and isinstance(args[0], _pd.DataFrame):
        df = args[0]
        n_rows, n_cols = df.shape
        if n_rows > 20:
            _original_print(f"DataFrame({n_rows:,} rows x {n_cols} cols)")
            _original_print(f"Columns: {list(df.columns)}")
            nulls = df.isnull().sum()
            if nulls.any():
                _original_print(f"Nulls: {dict(nulls[nulls > 0])}")
            num = df.select_dtypes(include='number')
            if not num.empty:
                _original_print("Numeric stats:")
                _original_print(num.describe().round(3).to_string())
            _original_print("First 5 rows:")
            _original_print(df.head(5).to_string())
            _original_print(f"[Full view: use print_full(df) or print_full(df, max_rows=N)]")
            return
    _original_print(*args, **kwargs)

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
    """Save an Altair chart (or Vega-Lite dict/JSON string) to the Artifacts panel."""
    import json as _json
    if isinstance(chart, dict):
        spec = _json.dumps(chart)
    elif isinstance(chart, str):
        spec = chart  # already a JSON string
    else:
        spec = chart.to_json()  # Altair chart object
    _result["charts"].append({"title": title, "spec": spec})

def save_mermaid(code, title="Diagram"):
    """Save a Mermaid diagram for the Artifacts panel."""
    _result["diagrams"].append({"title": title, "code": code})

def show_component(component_or_list, title=""):
    """Render A2UI component(s) inline in the current chat message.

    component_or_list: a single component dict, a list of component dicts,
                       or a JSON string of either.
    title: optional group title displayed above the block in the chat bubble.
    """
    import json as _json
    if isinstance(component_or_list, dict):
        components = [component_or_list]
    elif isinstance(component_or_list, list):
        components = component_or_list
    elif isinstance(component_or_list, str):
        parsed = _json.loads(component_or_list)
        components = parsed if isinstance(parsed, list) else [parsed]
    else:
        components = [component_or_list]
    _result["inline_components"].append({"components": components, "title": title})

def save_artifact(content, title="", artifact_type="table", format=None):
    """Universal save — works for tables, charts, and diagrams.

    content: DataFrame or HTML string (tables), Altair chart or dict/JSON (charts), Mermaid string (diagrams)
    artifact_type: "table" | "chart" | "diagram"  (or inferred from content type)
    format: "html" | "vega-lite" | "mermaid"  (optional, overrides artifact_type)
    """
    import pandas as _pd
    _type = format or artifact_type
    if _type in ("chart", "vega-lite") or hasattr(content, "to_json") or isinstance(content, dict):
        save_chart_vegalite(content, title)
    elif _type in ("diagram", "mermaid"):
        save_mermaid(content, title)
    else:
        # table: accept DataFrame or raw HTML string
        if isinstance(content, _pd.DataFrame):
            save_table_html(content, title)
        else:
            html = str(content)
            _result["tables_html"].append({"title": title, "html": html})

def update_artifact(artifact_id, content, title=None):
    """Update an existing artifact from inside run_python.

    Use this when refining or changing an existing chart, table, or diagram.
    The artifact panel will reflect the change immediately.

    artifact_id: the ID of the artifact to update (e.g. "535c6589")
    content:     the new content — Altair chart object, vega-lite dict, JSON string, or Mermaid string
    title:       optional new title; leave None to keep the current title

    Example (chart refinement):
        chart = alt.Chart(df).mark_bar().encode(...)
        chart = gs_theme(chart, "Inflation Rate Over Time")
        update_artifact("535c6589", chart)
    """
    import json as _json
    if isinstance(content, dict):
        spec = _json.dumps(content)
    elif isinstance(content, str):
        spec = content
    else:
        spec = content.to_json()  # Altair chart object
    _result["artifact_updates"].append({"artifact_id": artifact_id, "content": spec, "title": title})

try:
    # Auto-import all OneGS helpers (gs_theme, styled_table_html, GS_MERMAID_THEME, constants)
    from sandbox_helpers import *
except ImportError:
    pass  # fallback: helpers unavailable but sandbox still works

def styled_chart(base_chart, title="", width=640, height=400):
    """Alias for gs_theme() — prefer gs_theme() for new code."""
    return gs_theme(base_chart, title=title, width=width, height=height)

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

    # A3: Auto-load persisted objects from previous sandbox calls.
    # Variables saved as _persist_* in a prior run are restored into globals().
    import glob as _glob
    _session_dir = f"/tmp/sandbox_{os.environ.get('SANDBOX_SESSION_ID', '')}"
    if _session_dir != "/tmp/sandbox_" and os.path.isdir(_session_dir):
        for _pkl in _glob.glob(f"{_session_dir}/*.pkl"):
            _vname = os.path.basename(_pkl).replace(".pkl", "")
            try:
                import joblib as _jl
                globals()[_vname] = _jl.load(_pkl)
            except Exception as _le:
                print(f"Warning: could not load {_vname}: {_le}", file=sys.stderr)

    # Execute user code
__USER_CODE__

    # A3: Auto-persist variables named _persist_* so they survive across sandbox calls.
    _persist_log = []
    if _session_dir != "/tmp/sandbox_":
        os.makedirs(_session_dir, exist_ok=True)
        for _k, _v in list(locals().items()):
            if _k.startswith("_persist_") and not _k.startswith("_persist_log"):
                try:
                    import joblib as _jl
                    _pkl_path = f"{_session_dir}/{_k}.pkl"
                    _jl.dump(_v, _pkl_path)
                    _persist_log.append(_k)
                except Exception as _pe:
                    print(f"Warning: could not persist {_k}: {_pe}", file=sys.stderr)
    if _persist_log:
        _original_print(f"[Persisted to session: {', '.join(_persist_log)}]")

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
