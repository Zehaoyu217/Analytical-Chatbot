# Debugging

## Quick Diagnosis

| Symptom | Check | Fix |
|---------|-------|-----|
| Chat sends, no response | Backend console | Ollama running? Model pulled? |
| SSE disconnects | Network > EventStream | CORS config, backend crash |
| "does not support tools" | Backend logs | Auto-falls back to ReAct; check NO_TOOL_MODELS |
| Upload fails | Backend console | data/uploads/ exists? File < 500MB? |
| Artifact not showing | Right panel > Artifacts | Check SSE events for `artifact` type |
| Chart not rendering | Browser console | Vega-Lite spec valid JSON? |
| Sandbox timeout | Backend logs | Increase sandbox.timeout_seconds |
| Empty LLM response | Backend logs | Reasoning model; check `<think>` stripping |
| DuckDB lock error | Backend logs | Sandbox temp copy failed; check disk space |
| Tool not called | Backend logs | Check executor tool log output |

## Inspecting SSE Events

1. Browser DevTools (F12) > Network > filter "chat"
2. Click the request > EventStream tab
3. Watch events: `progress`, `artifact`, `dashboard`, `message`, `done`, `error`

## Backend Logging

```bash
LOG_LEVEL=DEBUG uvicorn app.main:app --reload
```

Key log lines:
- `executor: model=X provider=Y supports_tools=Z` -- LLM selection
- `executor: LLM responded in X.Xs, N tool calls` -- performance
- `tool: calling X with args keys=[...]` -- tool invocation
- `tool: X returned N chars` -- tool result

## Common Errors

**DuckDB "table not found"**: Table names have hash suffixes (e.g., `sales_data_abc123`). Schemas are in the system prompt; check the actual table name there.

**"No module named X" in sandbox**: Add to `config.yaml > sandbox.allowed_packages` AND `sandbox-requirements.txt`, then `pip install` in venv.

**CORS errors**: Check `config.yaml > server.cors_origins` includes frontend URL.

**ContextVar session issues**: Ensure executor_node sets `current_session_id` before tool execution. All tools should import from `agent/context.py`.
