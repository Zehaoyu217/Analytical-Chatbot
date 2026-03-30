#!/usr/bin/env python3
"""Trace file summarizer — parse raw trace JSON into a clean, readable summary.

Usage:
    python trace_summary.py                    # Latest trace
    python trace_summary.py --last 5           # Last 5 traces
    python trace_summary.py --session <id>     # Specific session
    python trace_summary.py --errors-only      # Only traces with errors
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

TRACES_DIR = Path(__file__).parent / "traces"


def find_traces(last: int = 1, session: str | None = None) -> list[Path]:
    """Find trace JSON files, sorted newest first."""
    if not TRACES_DIR.exists():
        print("No traces directory found.")
        return []

    if session:
        session_dir = TRACES_DIR / session
        if not session_dir.exists():
            # Try partial match
            matches = [d for d in TRACES_DIR.iterdir() if d.is_dir() and session in d.name]
            if not matches:
                print(f"Session '{session}' not found.")
                return []
            session_dir = matches[0]
        jsons = sorted(session_dir.glob("*.json"), reverse=True)
        return jsons[:1] if jsons else []

    # Collect all trace files with their mtime
    all_traces = []
    for session_dir in TRACES_DIR.iterdir():
        if not session_dir.is_dir():
            continue
        for f in session_dir.glob("*.json"):
            all_traces.append((f.stat().st_mtime, f))

    all_traces.sort(key=lambda x: x[0], reverse=True)
    return [f for _, f in all_traces[:last]]


def summarize_trace(path: Path, errors_only: bool = False) -> str | None:
    """Parse a trace file and return a clean summary."""
    with open(path) as f:
        data = json.load(f)

    question = data.get("question", "?")
    response = data.get("response", "")
    elapsed = data.get("total_elapsed_s", 0)
    event_count = data.get("event_count", 0)
    session_id = data.get("session_id", "?")
    timestamp = data.get("timestamp", "?")

    events = data.get("events", [])

    # Extract tool calls
    tool_calls = []
    current_tool: dict = {}
    for e in events:
        et = e["event_type"]
        if et == "tool_start":
            current_tool = {
                "tool": e["data"].get("tool", "?"),
                "args": e["data"].get("args_preview", ""),
                "elapsed_s": e.get("elapsed_s", 0),
                "agent": e.get("agent_id", ""),
            }
        elif et == "tool_end":
            result = e["data"].get("result_preview", "")
            is_error = "Error" in result or "error" in result
            tc = current_tool if current_tool else {
                "tool": e["data"].get("tool", "?"),
                "args": "",
                "agent": e.get("agent_id", ""),
            }
            tc["result"] = result[:300]
            tc["is_error"] = is_error
            tc["duration"] = e["data"].get("elapsed_s", 0)
            tool_calls.append(tc)
            current_tool = {}

    # Extract thinking events
    thinking_events = [e for e in events if e["event_type"] == "thinking"]

    # Extract agent_status events
    agent_events = [e for e in events if e["event_type"] == "agent_status"]

    errors = [tc for tc in tool_calls if tc.get("is_error")]

    if errors_only and not errors:
        return None

    # Build summary
    lines = []
    lines.append(f"{'=' * 80}")
    lines.append(f"Session:  {session_id}")
    lines.append(f"Time:     {timestamp}")
    lines.append(f"Question: {question}")
    lines.append(f"Elapsed:  {elapsed:.1f}s | Events: {event_count} | Tools: {len(tool_calls)} | Errors: {len(errors)}")
    lines.append(f"Response: {response[:200]}{'...' if len(response) > 200 else ''}")
    lines.append("")

    if tool_calls:
        lines.append("  Tool Calls:")
        for i, tc in enumerate(tool_calls, 1):
            status = "ERROR" if tc.get("is_error") else "OK"
            duration = f"{tc.get('duration', '?')}s" if tc.get("duration") else ""
            lines.append(f"    {i}. [{status}] {tc['tool']} ({duration})")
            if tc.get("args"):
                lines.append(f"       Args: {tc['args'][:120]}")
            if tc.get("is_error"):
                lines.append(f"       Result: {tc['result'][:200]}")

    # Detect repeated errors (same tool + same error)
    if len(errors) >= 2:
        error_sigs = [f"{e['tool']}:{e['result'][:80]}" for e in errors]
        from collections import Counter
        repeats = {sig: count for sig, count in Counter(error_sigs).items() if count > 1}
        if repeats:
            lines.append("")
            lines.append("  REPEATED ERRORS (agent stuck in loop):")
            for sig, count in repeats.items():
                tool_name, err_preview = sig.split(":", 1)
                lines.append(f"    {tool_name} x{count}: {err_preview}")

    if thinking_events:
        lines.append("")
        lines.append(f"  Thinking events: {len(thinking_events)}")

    if agent_events:
        lines.append("")
        lines.append("  Sub-agent activity:")
        for ae in agent_events:
            d = ae["data"]
            lines.append(f"    {d.get('agent_name', '?')}: {d.get('status', '?')} — {d.get('task', '')[:80]}")

    lines.append("")
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Summarize analytical chatbot trace files")
    parser.add_argument("--last", type=int, default=1, help="Number of latest traces to show (default: 1)")
    parser.add_argument("--session", type=str, help="Specific session ID (or prefix)")
    parser.add_argument("--errors-only", action="store_true", help="Only show traces with errors")
    args = parser.parse_args()

    traces = find_traces(last=args.last, session=args.session)
    if not traces:
        print("No traces found.")
        sys.exit(1)

    shown = 0
    for path in traces:
        summary = summarize_trace(path, errors_only=args.errors_only)
        if summary:
            print(summary)
            shown += 1

    if shown == 0:
        print("No matching traces found.")


if __name__ == "__main__":
    main()
