# Architecture

## System Overview

```
User (Browser)
    |
    v
React 19 UI (3-panel: sidebar | chat | workspace)
    |  SSE streaming (progress, artifacts, dashboard, messages)
    v
FastAPI Backend (POST /api/chat)
    |
    v
LangGraph Agent (stateful graph with checkpointing)
    |
    +--> Router Node       (keyword matching, no LLM)
    +--> Skill Loader Node (reads .md skill file)
    +--> Executor Node     (LLM + tool loop)
    |       |
    |       +--> query_duckdb (SQL)
    |       +--> run_python   (sandboxed subprocess)
    |       +--> save_artifact / save_dashboard_component
    |
    +--> Responder Node    (pass-through, extension point)
    |
    v
SSE Event Stream --> Frontend renders results
```

## Data Flow

### Upload
```
File drop --> POST /api/upload --> validate --> save to data/uploads/
  --> DuckDB ingestion (read_csv_auto / st_read / read_parquet)
  --> Register in _datasets_catalog: {table_name}_{hash}
```

### Question --> Answer
```
User question --> POST /api/chat {message, session_id, model, provider}
  --> LangGraph agent.astream(stream_mode="updates")
  --> Router: keyword match --> skill name (or None)
  --> Skill Loader: inject .md content into state
  --> Executor:
      1. Build system prompt (base + data context + skill)
      2. LLM call with tools bound
      3. Tool loop: call tool --> execute --> feed result back --> repeat
      4. Final AIMessage
  --> Responder: pass-through
  --> SSE events: progress, artifact, dashboard, message, done
```

### Artifact Flow
```
Agent calls run_python() with sandbox helpers
  --> Sandbox: save_table_html(df) or save_chart_vegalite(chart)
  --> SandboxResult.charts / .tables_html returned
  --> run_python tool creates Artifact objects, saves to store
  --> chat.py emits SSE "artifact" events (deduped by ID)
  --> Frontend: chatStore.addArtifact() --> renders in UI
```

## File Map

### Backend (`backend/app/`)

| Area | File | Purpose |
|------|------|---------|
| **API** | `api/chat.py` | SSE chat endpoint, event generator |
| | `api/upload.py` | File upload (CSV/Excel/Parquet) |
| | `api/datasets.py` | Dataset CRUD |
| | `api/models.py` | LLM model listing |
| | `api/sessions.py` | Session management |
| | `api/artifacts.py` | Artifact retrieval |
| **Agent** | `agent/graph.py` | StateGraph definition, compiled singleton |
| | `agent/state.py` | AgentState (messages, skill, tool_calls_log) |
| | `agent/context.py` | Shared ContextVar for session_id |
| | `agent/nodes/router.py` | Keyword-based skill routing |
| | `agent/nodes/skill_loader.py` | Loads .md skill into state |
| | `agent/nodes/executor.py` | LLM + tool loop (native + ReAct fallback) |
| | `agent/nodes/responder.py` | Pass-through (extension point) |
| | `agent/prompts/system_prompt.md` | Base system prompt |
| **Tools** | `agent/tools/query_duckdb.py` | SQL execution (SELECT/WITH only) |
| | `agent/tools/run_python.py` | Sandboxed Python + artifact extraction |
| | `agent/tools/list_datasets.py` | List DuckDB tables |
| | `agent/tools/get_schema.py` | Column names/types/samples |
| | `agent/tools/load_skill.py` | Load skill at runtime |
| | `agent/tools/save_artifact.py` | Save artifacts + dashboard components |
| **Data** | `data/duckdb_manager.py` | DuckDB connection + queries |
| | `data/ingest.py` | File ingestion |
| | `data/catalog.py` | Dataset metadata |
| **Other** | `llm/provider.py` | LLM factory (Ollama/OpenAI/Anthropic/Google) |
| | `sandbox/executor.py` | Subprocess runner |
| | `sandbox/runner.py` | Subprocess template with helpers |
| | `sandbox/validator.py` | AST import whitelist |
| | `artifacts/store.py` | In-memory artifact/progress/dashboard store |
| | `config.py` | YAML + env config loader |
| | `main.py` | FastAPI app factory |

### Frontend (`frontend/src/`)

| Area | File | Purpose |
|------|------|---------|
| **Hooks** | `hooks/useChat.ts` | Chat + SSE streaming |
| | `hooks/useDatasets.ts` | Dataset management |
| | `hooks/useModels.ts` | Model selection |
| **State** | `stores/chatStore.ts` | Messages, progress, artifacts, dashboard |
| | `stores/settingsStore.ts` | Model/provider |
| **Network** | `lib/sse.ts` | SSE event parser |
| | `lib/api.ts` | REST client |
| **Chat** | `components/chat/ChatContainer.tsx` | Chat UI + empty state |
| | `components/chat/ChatInput.tsx` | Input field |
| | `components/chat/StreamingMessage.tsx` | Streaming response |
| **Layout** | `components/layout/LeftPanel.tsx` | Sidebar |
| | `components/layout/RightPanel.tsx` | Progress + Workspace tabs |
| **Workspace** | `components/workspace/AgentWorkspace.tsx` | Dashboard + artifacts |
| | `components/workspace/DashboardRenderer.tsx` | Metric cards, grids |
| | `components/workspace/VegaChart.tsx` | Vega-Lite renderer |
| | `components/workspace/MermaidDiagram.tsx` | Mermaid renderer |

## Key Design Decisions

1. **Keyword routing (no LLM)** -- Zero-latency intent classification. Trade-off: less flexible than LLM routing, but eliminates a full roundtrip.
2. **Data context always in system prompt** -- Schemas + 5-row sample pre-loaded. LLM can query directly without discovery tools. Saves 2+ LLM calls per question.
3. **Anti-hallucination by design** -- System prompt forbids fabricating values. LLM must use tools for computation. Sample data is explicitly labeled as "for structure only."
4. **Sandbox via temp DB copy** -- DuckDB single-writer lock prevents shared access. Sandbox copies the file to /tmp, opens read-only. Cleaned up after execution.
5. **Skills as markdown** -- Auto-discovered, no code changes. New skill = new .md file. Injected into system prompt at runtime.
6. **SSE over WebSocket** -- Simpler protocol, works with HTTP/1.1, natural fit for server-push events. Trade-off: no bidirectional streaming.
