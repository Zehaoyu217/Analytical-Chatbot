from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import textwrap
from pathlib import Path
from typing import Any

from app.config import get_config
from app.sandbox.validator import validate_code, SandboxValidationError
from app.sandbox.runner import RUNNER_TEMPLATE


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
        return_value: Any = None,
    ):
        self.stdout = stdout
        self.stderr = stderr
        self.error = error
        self.figures = figures or []
        self.charts = charts or []
        self.tables_html = tables_html or []
        self.diagrams = diagrams or []
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
            "return_value": self.return_value,
        }


def execute_python(code: str) -> SandboxResult:
    """Execute Python code in a sandboxed subprocess."""
    cfg = get_config()

    if not cfg.sandbox.enabled:
        return SandboxResult(error="Sandbox execution is disabled")

    # Step 1: AST validation
    try:
        validate_code(code)
    except SandboxValidationError as e:
        return SandboxResult(error=str(e))

    # Step 2: Checkpoint DuckDB WAL so sandbox copy sees all tables
    from app.data.duckdb_manager import get_duckdb
    try:
        get_duckdb().execute("CHECKPOINT")
    except Exception:
        pass  # Non-critical: sandbox may still work if WAL is small

    # Step 3: Build runner script
    indented_code = textwrap.indent(code, "    ")
    duckdb_path = str(Path(cfg.data.duckdb_path).resolve())
    script = RUNNER_TEMPLATE.replace("__USER_CODE__", indented_code).replace("__DUCKDB_PATH__", duckdb_path)

    # Step 4: Execute in subprocess
    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
        f.write(script)
        script_path = f.name

    try:
        result = subprocess.run(
            [sys.executable, script_path],
            capture_output=True,
            text=True,
            timeout=cfg.sandbox.timeout_seconds,
            env=_sandbox_env(),
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


def _sandbox_env() -> dict[str, str]:
    """Create a restricted environment for the subprocess."""
    import os
    env = os.environ.copy()
    # Remove sensitive env vars
    for key in ("OPENAI_API_KEY", "ANTHROPIC_API_KEY", "AWS_SECRET_ACCESS_KEY"):
        env.pop(key, None)
    return env
