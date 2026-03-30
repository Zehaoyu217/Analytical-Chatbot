from __future__ import annotations

import ast
from typing import Any

from app.sandbox.config import get_allowed_packages, FORBIDDEN_MODULES


class SandboxValidationError(Exception):
    pass


def validate_code(source: str) -> None:
    """Validate Python source code using AST analysis.

    Raises SandboxValidationError if forbidden imports or patterns are detected.
    """
    try:
        tree = ast.parse(source)
    except SyntaxError as e:
        raise SandboxValidationError(f"Syntax error: {e}")

    allowed = get_allowed_packages()

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                _check_module(alias.name, allowed)

        elif isinstance(node, ast.ImportFrom):
            if node.module:
                _check_module(node.module, allowed)

        elif isinstance(node, ast.Call):
            # Block exec(), eval(), compile(), __import__()
            func = node.func
            if isinstance(func, ast.Name) and func.id in ("exec", "eval", "compile", "__import__"):
                raise SandboxValidationError(f"Forbidden builtin: {func.id}()")
            if isinstance(func, ast.Attribute) and func.attr in ("system", "popen", "exec"):
                raise SandboxValidationError(f"Forbidden call: .{func.attr}()")


def _check_module(module_name: str, allowed: frozenset[str]) -> None:
    """Check if a module import is allowed."""
    top_level = module_name.split(".")[0]

    if top_level in FORBIDDEN_MODULES or module_name in FORBIDDEN_MODULES:
        raise SandboxValidationError(f"Forbidden module: {module_name}")

    if top_level not in allowed:
        raise SandboxValidationError(
            f"Module not in whitelist: {module_name}. "
            f"Allowed: {sorted(allowed)}"
        )
