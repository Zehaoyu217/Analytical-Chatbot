"""read_result tool — load a previously offloaded large tool result back into context.

Large tool results (>1500 chars) are automatically written to disk and replaced
with a compact reference + preview in the message history. Use read_result() to
load the full content when you need to re-examine it.
"""
from __future__ import annotations

import logging
from pathlib import Path

from langchain_core.tools import tool

logger = logging.getLogger(__name__)

_MAX_READ = 8000  # chars — cap to prevent context flooding on re-read


@tool
def read_result(path: str) -> str:
    """Load a previously offloaded large tool result back into context.

    Use this when you need to re-examine a large SQL or Python result from
    an earlier step that was automatically archived to disk.

    Args:
        path: The file path shown in the [Result → /tmp/agent_results/...] reference.
    """
    try:
        content = Path(path).read_text(encoding="utf-8")
        if len(content) > _MAX_READ:
            return content[:_MAX_READ] + f"\n...[truncated — {len(content):,} total chars. File: {path}]"
        return content
    except FileNotFoundError:
        return f"Error: File not found: {path}\nThe file may have been cleaned up. Re-run the original tool call."
    except Exception as e:
        return f"Error reading {path}: {e}"
