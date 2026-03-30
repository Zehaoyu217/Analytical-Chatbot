from __future__ import annotations

import json
import re
import subprocess
import sys
import tempfile
import textwrap
from pathlib import Path
from typing import Any

from app.config import get_config
from app.sandbox.validator import validate_code, SandboxValidationError
from app.sandbox.runner import RUNNER_TEMPLATE


# ── A6: Output size guard ────────────────────────────────────────────

_OUTPUT_DANGER = [
    (
        r"model\.summary\(\)",
        "Output size guard: model.summary() outputs ~3000+ chars and will overflow the context window. "
        "Print specific fields instead: print(f'R2={model.rsquared:.4f}, AIC={model.aic:.1f}')",
    ),
    (
        r"for\s+\w+\s*,\s*\w+\s+in\s+\w+\.iterrows\(\)",
        "Output size guard: iterrows() is O(n) Python loop and extremely slow on large datasets. "
        "Use vectorized operations or .apply() instead.",
    ),
    # NOTE: bare print(df) is intentionally NOT blocked here — the A1 DataFrame interceptor
    # in RUNNER_TEMPLATE handles it at runtime by producing a compact summary instead.
]


def _output_danger_check(code: str) -> str | None:
    """Return an error message if code contains known high-volume output patterns."""
    for pattern, msg in _OUTPUT_DANGER:
        if re.search(pattern, code, re.MULTILINE):
            return msg + "\nFix and retry."
    return None


# ── A2: Ruff pre-execution lint ──────────────────────────────────────

def _ruff_lint(code: str) -> str | None:
    """Run ruff on code. Returns error message string or None if clean/skipped."""
    import shutil
    if not shutil.which("ruff"):
        return None  # ruff not installed — skip silently
    try:
        r = subprocess.run(
            ["ruff", "check", "--select", "F821,E999", "--output-format", "json", "-"],
            input=code.encode(),
            capture_output=True,
            timeout=5,
        )
        if r.returncode == 0:
            return None
        issues = json.loads(r.stdout or "[]")
        critical = [i for i in issues if i.get("code") in ("F821", "E999")]
        if not critical:
            return None
        lines = [
            f"  Line {i['location']['row']}: [{i['code']}] {i['message']}"
            for i in critical[:3]
        ]
        return "Pre-execution lint error:\n" + "\n".join(lines) + "\nFix and retry."
    except Exception:
        return None  # Never block execution due to linter failure


class SandboxResult:
    def __init__(
        self,
        stdout: str = "",
        stderr: str = "",
        error: str | None = None,
        figures: list[str] | None = None,
        charts: list[dict] | None = None,
        tables_html: list[dict] | None = None,
        diagrams: list[dict] | None = None,
        inline_components: list[dict] | None = None,
        artifact_updates: list[dict] | None = None,
        return_value: Any = None,
    ):
        self.stdout = stdout
        self.stderr = stderr
        self.error = error
        self.figures = figures or []
        self.charts = charts or []
        self.tables_html = tables_html or []
        self.diagrams = diagrams or []
        self.inline_components = inline_components or []
        self.artifact_updates = artifact_updates or []
        self.return_value = return_value

    def to_dict(self) -> dict[str, Any]:
        return {
            "stdout": self.stdout,
            "stderr": self.stderr,
            "error": self.error,
            "figures": self.figures,
            "charts": self.charts,
            "tables_html": self.tables_html,
            "diagrams": self.diagrams,
            "inline_components": self.inline_components,
            "artifact_updates": self.artifact_updates,
            "return_value": self.return_value,
        }


def execute_python(code: str, session_id: str | None = None) -> SandboxResult:
    """Execute Python code in a sandboxed subprocess."""
    cfg = get_config()

    if not cfg.sandbox.enabled:
        return SandboxResult(error="Sandbox execution is disabled")

    # Step 1: Output size guard — catch known context-flooding patterns before running
    danger = _output_danger_check(code)
    if danger:
        return SandboxResult(error=danger)

    # Step 2: AST validation
    try:
        validate_code(code)
    except SandboxValidationError as e:
        return SandboxResult(error=str(e))

    # Step 3: Ruff pre-lint — catch undefined names and syntax errors early
    lint_error = _ruff_lint(code)
    if lint_error:
        return SandboxResult(error=lint_error)

    # Step 4: Checkpoint DuckDB WAL so sandbox copy sees all tables
    from app.data.duckdb_manager import get_duckdb
    try:
        get_duckdb().execute("CHECKPOINT")
    except Exception:
        pass  # Non-critical: sandbox may still work if WAL is small

    # Step 5: Build runner script
    indented_code = textwrap.indent(code, "    ")
    duckdb_path = str(Path(cfg.data.duckdb_path).resolve())
    script = RUNNER_TEMPLATE.replace("__USER_CODE__", indented_code).replace("__DUCKDB_PATH__", duckdb_path)

    # Step 6: Execute in subprocess
    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
        f.write(script)
        script_path = f.name

    try:
        result = subprocess.run(
            [sys.executable, script_path],
            capture_output=True,
            text=True,
            timeout=cfg.sandbox.timeout_seconds,
            env=_sandbox_env(session_id=session_id),
        )

        # Parse result
        output = result.stdout
        if "__SANDBOX_RESULT__" in output:
            json_str = output.split("__SANDBOX_RESULT__")[1].strip()
            data = json.loads(json_str)
            return SandboxResult(**data)
        else:
            return SandboxResult(
                stdout=result.stdout,
                stderr=result.stderr,
                error="Failed to capture sandbox result" if result.returncode != 0 else None,
            )

    except subprocess.TimeoutExpired:
        return SandboxResult(error=f"Execution timed out after {cfg.sandbox.timeout_seconds}s")
    except Exception as e:
        return SandboxResult(error=f"Sandbox error: {e}")
    finally:
        Path(script_path).unlink(missing_ok=True)


def _sandbox_env(session_id: str | None = None) -> dict[str, str]:
    """Create a restricted environment for the subprocess."""
    import os
    env = os.environ.copy()
    # Remove sensitive env vars
    for key in ("OPENAI_API_KEY", "ANTHROPIC_API_KEY", "AWS_SECRET_ACCESS_KEY"):
        env.pop(key, None)
    # Make sandbox_helpers importable inside the subprocess
    backend_dir = str(Path(__file__).parent.parent.parent)
    existing = env.get("PYTHONPATH", "")
    env["PYTHONPATH"] = backend_dir + (os.pathsep + existing if existing else "")
    # A3: Pass session ID so the runner can load/save _persist_* variables
    if session_id:
        env["SANDBOX_SESSION_ID"] = session_id
    return env
