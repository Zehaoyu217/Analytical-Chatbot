# Framework Enhancement Rollback Guide

**Date**: 2026-03-25
**Purpose**: Document every file touched per sprint so any change can be spot-checked or reverted independently.

Each section lists: what changed, what the original was, and the minimal revert steps.

---

## How to Use This Guide

- **Spot-check a change**: Compare current file to the "Original state" section below.
- **Revert one enhancement**: Apply only the revert steps for that enhancement (e.g., remove `EvaluatorMiddleware` from the middleware list).
- **Revert an entire sprint**: Apply all revert steps for that sprint in reverse order.
- **Full rollback**: `git diff HEAD~N -- <file>` to see every change since the last clean commit, or restore from the git stash/branch created before implementation started.

> **Recommendation**: Create a git branch or stash before starting each sprint. Run `git stash` now if you haven't already. This guide is a supplement — git is the authoritative rollback mechanism.

---

## Pre-Implementation Baseline Snapshot

Run these before touching anything to capture line counts for quick drift detection:

```bash
wc -l backend/app/agent/deep_agent.py          # ~407 lines
wc -l backend/app/sandbox/runner.py            # ~161 lines (RUNNER_TEMPLATE string)
wc -l backend/app/sandbox/executor.py          # ~125 lines
wc -l backend/app/agent/tools/run_python.py    # ~151 lines
wc -l backend/app/agent/prompts/system_prompt.md  # ~95 lines
```

---

## Sprint 1 — Standalone Safety Improvements (H1, A1, A2, A5, A6)

Sprint 1 items have no dependencies on each other. Each can be reverted independently.

### H1 — EvaluatorMiddleware

**File**: `backend/app/agent/deep_agent.py`

**What was added**:
- New class `EvaluatorMiddleware` inserted after `ToolResultCompactionMiddleware` (~line 249)
- `EvaluatorMiddleware()` added to the `middleware` list in `build_deep_agent()` (~line 340)

**Original middleware list** (lines 340–343):
```python
middleware = [
    ToolResultCompactionMiddleware(max_keep=max_keep),
    EventBusMiddleware(),
]
```

**Revert**: Remove the `EvaluatorMiddleware` class definition and remove it from the `middleware` list. The list must return to exactly:
```python
middleware = [
    ToolResultCompactionMiddleware(max_keep=max_keep),
    EventBusMiddleware(),
]
```

**Verify**: `grep -n "EvaluatorMiddleware" backend/app/agent/deep_agent.py` → should return nothing after revert.

---

### A1 — DataFrame Auto-Summary (print interceptor)

**File**: `backend/app/sandbox/runner.py`

**What was added**: A `print` override injected into `RUNNER_TEMPLATE` immediately after the `_result = {...}` dict definition and before the `print_full` function definition. The override intercepts single-DataFrame `print()` calls and replaces them with a compact summary (shape, columns, nulls, describe, head(5)) when the DataFrame has > 20 rows.

**Original RUNNER_TEMPLATE section** (after `_result = {...}` line, before `def print_full`):
```
(nothing — print_full was the first function defined)
```

**Revert**: Delete the `print` override block from RUNNER_TEMPLATE. The section from `_original_print = print` through the closing `_original_print(*args, **kwargs)` line must be removed. `print_full` should be the first function defined after `_result`.

**Verify**: `grep -n "_original_print" backend/app/sandbox/runner.py` → should return nothing after revert.

---

### A2 — Ruff Pre-Execution Lint

**File**: `backend/app/sandbox/executor.py`

**What was added**:
- Private function `_ruff_lint(code: str) -> str | None` added before `execute_python`
- One call to `_ruff_lint(code)` added in `execute_python()` between Step 1 (AST validation) and Step 2 (WAL checkpoint), returning early with a `SandboxResult(error=...)` if lint fails

**Original `execute_python` step sequence**:
```
# Step 1: AST validation
# Step 2: Checkpoint DuckDB WAL
# Step 3: Build runner script
# Step 4: Execute in subprocess
```

**Revert**: Delete the `_ruff_lint` function and the call to it inside `execute_python`. The step numbering should return to 1→2→3→4.

**Verify**: `grep -n "_ruff_lint" backend/app/sandbox/executor.py` → nothing after revert.

---

### A5 — Schema-Aware Error Injection

**File**: `backend/app/agent/tools/run_python.py`

**What was changed**: The `KeyError` / column-not-found branch in the `if result.error:` block (starting ~line 53) was enhanced. Instead of the generic "COLUMN/KEY NOT FOUND. Call get_schema()" message, it now:
1. Extracts the bad key name from the error string
2. Queries all table schemas via `get_catalog()` + `get_duckdb()`
3. Uses `difflib.get_close_matches` to find the nearest column name
4. Inserts a full column listing + suggestion at the front of `parts`

**Original KeyError branch** (lines 53–57):
```python
if "keyerror" in error_lower or "column" in error_lower or "not found" in error_lower:
    parts.append(
        "COLUMN/KEY NOT FOUND. Call get_schema(table_name) to check the actual column "
        "names, then fix your code with the correct names and retry."
    )
```

**Revert**: Replace the enhanced KeyError block with the original 5-line version above.

**Verify**: `grep -n "difflib" backend/app/agent/tools/run_python.py` → nothing after revert.

---

### A6 — Output Size Guard

**File**: `backend/app/sandbox/executor.py`

**What was added**:
- `OUTPUT_DANGER` list of `(pattern, message)` tuples defined at module level
- Private function `_output_danger_check(code: str) -> str | None` added before `execute_python`
- One call to `_output_danger_check(code)` added in `execute_python()` between Step 1 (AST) and the Ruff lint step (A2), returning early with `SandboxResult(error=...)` if dangerous pattern found

**Original**: No such check existed. AST validation was the only pre-execution code scan.

**Revert**: Delete `OUTPUT_DANGER`, `_output_danger_check`, and the call inside `execute_python`.

**Verify**: `grep -n "OUTPUT_DANGER" backend/app/sandbox/executor.py` → nothing after revert.

---

## Sprint 2 — Foundation Layer (H5, H6, H2)

Sprint 2 builds on Sprint 1 being complete. H5 must be reverted before H6 and H2 if doing a full sprint rollback.

### H5 — Persistent Agent State

**Files touched**:
1. `backend/app/agent/persistent_state.py` (**NEW FILE**)
2. `backend/app/agent/tools/record_finding.py` (**NEW FILE**)
3. `backend/app/agent/deep_agent.py` (imports + middleware + tools)
4. `backend/app/agent/prompts/system_prompt.md` (new `record_finding` section)
5. `config/config.yaml` (optional: `agent.persistent_state_db` path)

**What `persistent_state.py` contains**:
- `AgentPersistentState` dataclass (schema, plan_phases, findings, python_namespace, artifacts, errors_resolved, tool_call_count)
- `PersistentStateStore` class (SQLite-backed, `load`/`save` methods)
- `PersistentStateMiddleware` class (injects state as SystemMessage in `before_agent`, updates state in `awrap_tool_call`)
- Module-level singleton `_persistent_store`

**What `record_finding.py` contains**:
- `@tool record_finding(finding, phase)` — agent-callable tool to write to persistent findings list

**What changed in `deep_agent.py`**:
- Import: `from app.agent.persistent_state import PersistentStateMiddleware, _persistent_store`
- Import: `from app.agent.tools.record_finding import record_finding`
- `record_finding` added to `AGENT_TOOLS` list
- `PersistentStateMiddleware(_persistent_store)` added as the FIRST item in the `middleware` list in `build_deep_agent()`

**Original `middleware` list** (after Sprint 1, before H5):
```python
middleware = [
    ToolResultCompactionMiddleware(max_keep=max_keep),
    EvaluatorMiddleware(),
    EventBusMiddleware(),
]
```

**After H5**:
```python
middleware = [
    PersistentStateMiddleware(_persistent_store),
    ToolResultCompactionMiddleware(max_keep=max_keep),
    EvaluatorMiddleware(),
    EventBusMiddleware(),
]
```

**What changed in `system_prompt.md`**: A new section `### Persistent Findings` added near the top of "Other Rules" explaining when to call `record_finding`.

**Revert H5**:
1. Delete `backend/app/agent/persistent_state.py`
2. Delete `backend/app/agent/tools/record_finding.py`
3. In `deep_agent.py`: remove the two new imports, remove `record_finding` from `AGENT_TOOLS`, remove `PersistentStateMiddleware(...)` from the `middleware` list
4. In `system_prompt.md`: remove the `record_finding` section
5. (Optional) Remove `agent.persistent_state_db` from `config/config.yaml`

**Verify**: `grep -rn "PersistentState\|record_finding" backend/app/agent/` → nothing after revert.

---

### H6 — SQLite Checkpoint Persistence

**Status**: DEFERRED — `SqliteSaver` (sync) and `AsyncSqliteSaver` (async) both use context managers and cannot be instantiated directly inside a sync `build_deep_agent()` factory without app lifespan wiring. `MemorySaver` remains in place.

**What remains unchanged**:
```python
from langgraph.checkpoint.memory import MemorySaver
checkpointer = MemorySaver()
```

**To implement H6 properly**: Wire `AsyncSqliteSaver` as an async context manager in `app/main.py` lifespan, store the instance as an app state var, pass it into `build_deep_agent()`. This is a non-trivial refactor deferred to a later sprint.

---

### H2 — Plan Validation Against Schema

**File**: `backend/app/agent/deep_agent.py`

**What was added**: Inside `EventBusMiddleware.awrap_tool_call`, after the `write_todos` silent pass block (line ~151), a call to `await _validate_plan(result_text)` is inserted, and if warnings are found, the result ToolMessage content is augmented. A new private async function `_validate_plan(plan_text: str) -> list[str]` is added at module level.

**Original `write_todos` block** in `awrap_tool_call` (lines ~148–151):
```python
# Native deepagents SDK handles write_todos with its own 'thinking' layout event.
# We silently run the handler here to prevent duplicated 'Running tools...' messages in the UI.
if tool_name == "write_todos":
    return await handler(request)
```

**After H2** — that block becomes:
```python
if tool_name == "write_todos":
    result = await handler(request)
    result_text = result.content if hasattr(result, "content") else str(result)
    warnings = await _validate_plan(result_text)
    if warnings:
        from langchain_core.messages import ToolMessage as _TM
        result = _TM(
            content=result_text + "\n\n[PLAN VALIDATOR warnings]:\n" + "\n".join(warnings),
            tool_call_id=result.tool_call_id,
        )
    return result
```

**Revert**: Delete the `_validate_plan` function and restore the original `write_todos` block (4 lines above).

**Verify**: `grep -n "_validate_plan" backend/app/agent/deep_agent.py` → nothing after revert.

---

## Sprint 3 — Storage Layer (C1, A3)

### C1 — Filesystem Offloading for Large Tool Results

**Files**:
- `backend/app/agent/deep_agent.py`:
  - `_OFFLOAD_THRESHOLD = 1500` constant at module level
  - `_OFFLOAD_SKIP_TOOLS` frozenset at module level
  - `_maybe_offload_result()` function added before `_validate_plan()`
  - Call to `_maybe_offload_result()` in `EventBusMiddleware.awrap_tool_call` after `handler(request)`
- `backend/app/agent/tools/read_result.py` (**NEW FILE**) — `read_result` tool
- `AGENT_TOOLS` gains `read_result`

**Threshold**: Results > 1500 chars are archived to `/tmp/agent_results/{session_id}/`. The tool result in message history becomes a compact reference with 5-line preview.

**Tools that skip offloading**: write_todos, record_finding, load_skill, list_datasets, save_artifact, save_dashboard_component, show_component, read_result.

**Revert**:
1. Delete `backend/app/agent/tools/read_result.py`
2. Remove `read_result` import and from `AGENT_TOOLS` in `deep_agent.py`
3. Remove `_OFFLOAD_THRESHOLD`, `_OFFLOAD_SKIP_TOOLS`, `_maybe_offload_result()` from `deep_agent.py`
4. Remove the `_maybe_offload_result()` call in `awrap_tool_call` (3 lines)

**Verify**: `grep -n "_maybe_offload\|read_result" backend/app/agent/deep_agent.py` → nothing after revert.

---

### A3 — Stateful Object Persistence Between Sandbox Calls

**Files**:
- `backend/app/sandbox/runner.py` — two blocks added to `RUNNER_TEMPLATE`:
  1. **Auto-load block** (after DuckDB setup, before user code): loads all `.pkl` files from `/tmp/sandbox_{SANDBOX_SESSION_ID}/` into `globals()`
  2. **Auto-persist block** (after user code): joblib-serializes all `_persist_*` locals to that dir
- `backend/app/sandbox/executor.py`:
  - `execute_python(code, session_id=None)` — added `session_id` param
  - `_sandbox_env(session_id=None)` — injects `SANDBOX_SESSION_ID` env var
  - `subprocess.run(...)` call updated to pass `session_id=session_id`
- `backend/app/agent/tools/run_python.py` — `execute_python(code, session_id=session_id)` call updated

**Convention**: Variables named `_persist_*` in sandbox code are automatically serialized. They're restored at the start of the next call in the same session. Requires `joblib` in the sandbox environment.

**Revert**:
1. In `runner.py`: Remove the auto-load block (glob+joblib.load) and auto-persist block
2. In `executor.py`: Remove `session_id` param from `execute_python` and `_sandbox_env`, remove `SANDBOX_SESSION_ID` from env
3. In `run_python.py`: Change `execute_python(code, session_id=session_id)` back to `execute_python(code)`

**Verify**: `grep -n "SANDBOX_SESSION_ID\|_persist_log" backend/app/sandbox/runner.py` → nothing after revert.

---

## Quick Verification Commands

After each sprint, run these to confirm nothing is broken:

```bash
# Backend tests
cd backend && source .venv/bin/activate && pytest tests/ -v

# Type check frontend
cd frontend && npx tsc --noEmit

# Frontend tests
cd frontend && npx vitest run

# E2E SSE test (requires backend running)
curl -N -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "what tables are available?", "session_id": "rollback-test"}' \
  2>/dev/null | head -20

# Syntax check all modified Python files
python -m py_compile backend/app/agent/deep_agent.py
python -m py_compile backend/app/sandbox/executor.py
python -m py_compile backend/app/sandbox/runner.py
python -m py_compile backend/app/agent/tools/run_python.py
```

---

## Rollback Decision Tree

```
Something broke after a sprint?
  │
  ├── Backend won't start (ImportError, SyntaxError)?
  │     → Revert the LAST file changed in that sprint
  │     → Run: python -m py_compile <file>
  │
  ├── Agent produces errors on tool calls?
  │     → Check if it's H1 (EvaluatorMiddleware) — revert H1 first
  │     → Check if it's A2 (Ruff lint blocking valid code) — revert A2
  │
  ├── Sandbox execution broken?
  │     → Revert A6 first (output size guard may be too strict)
  │     → Then A2 (ruff lint)
  │     → Then A1 (print interceptor syntax error?)
  │
  ├── Context window blowing up despite H5?
  │     → Check PersistentStateMiddleware is injecting correctly
  │     → Verify ToolResultCompactionMiddleware still in middleware list
  │
  └── Tests failing?
        → Run: cd frontend && npx vitest run --reporter=verbose
        → Run: cd backend && pytest tests/ -v
        → Identify which test file fails → match to enhancement → revert that one
```

---

## Files NOT Modified (for reference)

These files are read-only during this enhancement plan — changes here would indicate scope creep:

- `backend/app/api/` — no API changes in Sprint 1 or 2
- `backend/app/events/bus.py` — EventBus unchanged
- `backend/app/data/` — DuckDB manager, catalog, ingest unchanged
- `frontend/src/` — no frontend changes in Sprint 1 or 2 (A7 in Sprint 3 touches sse.ts)
- `backend/app/skills/` — skill files unchanged (were already updated in previous session)
- `backend/tests/` — tests may need updates if new tools are added to AGENT_TOOLS

---

*Last updated: 2026-03-25 — Sprint 1 + Sprint 2 + Sprint 3 implemented*
