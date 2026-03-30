from __future__ import annotations

from app.config import get_config

# Modules that are always allowed in the sandbox
ALWAYS_ALLOWED_MODULES = frozenset({
    "math", "statistics", "collections", "itertools", "functools",
    "datetime", "json", "csv", "re", "io", "os.path", "pathlib",
    "typing", "dataclasses", "enum", "decimal", "fractions",
    "operator", "string", "textwrap", "copy", "pprint",
})

# Top-level packages from config (e.g., "pandas", "numpy")
def get_allowed_packages() -> frozenset[str]:
    cfg = get_config()
    return frozenset(cfg.sandbox.allowed_packages) | ALWAYS_ALLOWED_MODULES


# Completely forbidden — never allow regardless of config
FORBIDDEN_MODULES = frozenset({
    "subprocess", "shutil", "socket", "http", "urllib",
    "requests", "httpx", "aiohttp", "ftplib", "smtplib",
    "ctypes", "importlib", "sys", "code", "codeop",
    "compileall", "pickle", "shelve", "marshal",
    "signal", "multiprocessing", "threading",
    "webbrowser", "antigravity", "turtle",
})
