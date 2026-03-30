# Known Issues & Learnings

## Resolved Issues

### Chat response not displaying (2026-03-17)
- **Root cause**: `_serialize()` called `model_dump()` on LangChain messages producing non-serializable dicts
- **Fix**: Custom serialization extracting only content/type/tool_calls. Frontend filters by `type === "ai"`.
- **Files**: `api/chat.py`, `hooks/useChat.ts`

### DuckDB file lock in sandbox (2026-03-17)
- **Root cause**: DuckDB single-writer locking. Backend holds lock, subprocess can't open file.
- **Fix**: Sandbox copies DB to temp location, opens read-only, cleans up after.
- **Files**: `sandbox/runner.py`

### save_artifact session context (2026-03-17)
- **Root cause**: ContextVar created fresh on every call (always returns default)
- **Fix**: Shared ContextVar in `agent/context.py`. Executor sets before tool execution.
- **Files**: `agent/context.py`, `tools/save_artifact.py`, `nodes/executor.py`

### Sandbox artifacts not reaching UI (2026-03-17)
- **Root cause**: `run_python` reported counts but didn't save to artifact store
- **Fix**: Tool creates Artifact objects from SandboxResult. `chat.py` dedupes by ID.
- **Files**: `tools/run_python.py`, `api/chat.py`

### Excessive LLM calls (2026-03-17)
- **Root cause**: Data context only pre-loaded for ReAct models
- **Fix**: Always include schemas + 5-row sample. Skills don't instruct discovery calls.
- **Files**: `nodes/executor.py`, `skills/sql_analysis.md`, `skills/data_profiling.md`

---

## Gotchas & Best Practices

### LLM
- Ollama models vary in tool support; executor auto-falls back to ReAct
- Reasoning models (qwen3, deepseek-r1) produce `<think>` blocks; stripped before display
- Data context (schemas + sample) always in system prompt to prevent redundant tool calls
- System prompt forbids fabricating values; LLM must use tools for computation

### DuckDB
- Table names have hash suffixes (`{name}_{hash}`); use list_datasets for actual names
- DuckDB SQL supports EXCLUDE, REPLACE, SAMPLE, QUALIFY, string slicing
- query_duckdb allows only SELECT/WITH (read-only enforcement)

### Sandbox
- AST validation rejects disallowed imports before execution
- Helpers injected as globals: `_db`, `print_full`, `save_table_html`, `save_chart_vegalite`
- DuckDB uses temp file copy to avoid lock conflicts
- Charts/tables from sandbox helpers automatically become artifacts in the UI

### Frontend
- SSE parser resets currentEvent to "message" after each data line (matches sse-starlette)
- Zustand store updates must be immutable (spread arrays/objects)
