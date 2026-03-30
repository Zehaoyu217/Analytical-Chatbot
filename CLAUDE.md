# Analytical Chatbot — Agent Operating Manual

## What Is This?

An **analytical chatbot agent** that ingests CSV/Excel data into DuckDB, then answers questions via LLM (Claude/GPT/Ollama). Built on LangChain's deepagents SDK with planning, sub-agent delegation, and real-time streaming.

**One sentence**: Upload data → chat with an AI analyst → get insights with charts.

---

## Quick Start

```bash
# Backend
cd backend && source .venv/bin/activate && uvicorn app.main:app --reload

# Frontend (new terminal)
cd frontend && npm run dev
```

Open http://localhost:5173 in browser.

---

## Tech Stack

- **Backend**: FastAPI, Python 3.13, LangGraph + deepagents SDK, DuckDB, Pydantic v2
- **Agent modes**: `single` (one agent + skills, default) or `multi` (orchestrator + 2 sub-agents) — toggle via `config.yaml`
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Zustand, React Query
- **Charts**: Altair (Vega-Lite preferred), matplotlib fallback
- **LLM**: Ollama (local, default: qwen3:8b), Claude/OpenAI (cloud) via LangChain
- **Sandbox**: Subprocess + AST import whitelist

---

## Project Structure

```
backend/app/
├── api/                  # REST endpoints (chat, upload, datasets, models, sessions)
├── agent/
│   ├── deep_agent.py     # Main agent factory — create_deep_agent() or simple chat graph
│   ├── graph.py           # Legacy wrapper → delegates to deep_agent.py
│   ├── context.py         # ContextVars (EventBus, session_id, model_config)
│   ├── state.py           # Agent state definitions
│   ├── nodes/             # Legacy graph nodes (router, executor, responder, skill_loader)
│   ├── tools/             # Agent tools (query_duckdb, run_python, save_artifact, etc.)
│   ├── agents/            # Sub-agent registry, executor, setup
│   └── prompts/           # System + sub-agent prompt templates
├── events/               # EventBus (asyncio.Queue per session, A2UI)
├── skills/               # Agent skills (*.md files, auto-discovered)
├── sandbox/              # Code execution sandbox (AST validator + subprocess)
├── data/                 # DuckDB manager, ingestion, catalog
├── artifacts/            # In-memory store (tables, charts, diagrams, dashboard)
└── llm/                  # LLM provider factory (Ollama/OpenAI/Anthropic/Google)

frontend/src/
├── components/
│   ├── layout/           # LeftPanel, RightPanel, ProgressPanel, ArtifactsPanel, TracePanel
│   ├── chat/             # ChatContainer, MessageList, ChatInput, MessageBubble, CodeBlock
│   ├── workspace/        # AgentWorkspace, DashboardRenderer, VegaChart, MermaidDiagram
│   ├── data/             # FileUpload, DatasetList, SchemaViewer
│   └── settings/         # ModelSelector
├── hooks/                # useChat (SSE streaming), useDatasets, useModels
├── stores/               # Zustand: chatStore, settingsStore
├── lib/                  # api.ts, sse.ts, funText.ts, utils.ts
└── types/                # TypeScript interfaces
```

---

## Agent Pipeline

Built on LangChain's `deepagents` SDK (`pip install deepagents`):

```
User Question
    ↓
[Deep Agent] — create_deep_agent() with custom tools + sub-agents
  ├── Built-in: Planning (write_todos), Auto-summarization (~80K chars)
  ├── Custom tools: query_duckdb, run_python, save_artifact, etc.
  ├── Sub-agents via `task` tool: analyst, visualizer
  ├── EventBus middleware for real-time tool_start/tool_end events
  └── Agent cached per model+provider combo, invalidated on data upload
    ↓
EventBus → SSE Stream → UI
```

### Model Support
- Only **tool-capable models** are supported (qwen3, claude, gpt, etc.) — full deep agent with tools + sub-agents
- Models without native tool calling (e.g., deepseek-r1) are **not supported**

### Key Design Decisions
- **deepagents SDK** — planning, context management, sub-agent delegation out of the box
- **Data context in system prompt** — schemas + 5-row sample pre-loaded, avoids extra roundtrips
- **Auto-save artifacts** — `query_duckdb` auto-saves results as HTML table artifacts
- **EventBus (A2UI)** — asyncio.Queue per session decouples event emission from SSE consumption

---

## SSE Event Protocol

The chat endpoint (`POST /api/chat`) returns an SSE stream:

| Event | Payload | Purpose |
|-------|---------|---------|
| `progress` | `{label, status, detail, started_at, finished_at}` | Agent execution steps |
| `artifact` | `{id, type, title, content, format}` | Saved tables/charts/diagrams |
| `dashboard` | `{component JSON}` | Dashboard component updates |
| `message` | `{node, data, session_id}` | Node output (contains LLM response) |
| `token_delta` | `{token, agent_id}` | Token-level streaming for typing effect |
| `thinking` | `{kind, label, items?, agent?, task?}` | Agent planning/delegation transparency |
| `tool_start` | `{tool, args_preview, agent_id}` | Tool execution begin |
| `tool_end` | `{tool, elapsed_s, result_preview, agent_id}` | Tool execution end |
| `agent_status` | `{agent_name, status, task, agent_id}` | Sub-agent lifecycle |
| `done` | `{session_id}` | Stream complete |
| `error` | `{error}` | Exception message |

---

## Agent Tools

| Tool | Purpose |
|------|---------|
| `query_duckdb(sql)` | Execute SQL (SELECT/WITH only), auto-saves results as artifact |
| `run_python(code)` | Sandboxed Python execution |
| `list_datasets()` | List all uploaded tables |
| `get_schema(table_name)` | Column names, types, sample rows |
| `save_artifact(title, content, type, format)` | Save table/chart/diagram to Artifacts panel |
| `update_artifact(artifact_id, title?, content?)` | Update an existing artifact |
| `get_artifact_content(artifact_id?)` | List or read artifacts |
| `load_skill(skill_name)` | Load skill instructions |
| `save_dashboard_component(component, title)` | Add to live dashboard |

*`suggest_followups` was removed — small models (qwen3) couldn't reliably call it with correct argument types, causing error loops.*

*Sub-agent delegation uses deepagents' built-in `task` tool (not a custom tool).*

### Skills System

Skills are hierarchical, folder-based knowledge modules the agent loads on demand:

```
backend/app/skills/
├── visualization/           # Top-level skill
│   ├── SKILL.md             # JSON metadata block, followed by content
│   ├── interactive_charts/  # Sub-skill
│   │   └── SKILL.md
│   └── styled_theme/        # Sub-skill
│       └── SKILL.md
├── data_profiling/SKILL.md
├── sql_analysis/SKILL.md
├── dashboard/SKILL.md
├── ...
```

- Agent sees skill names + descriptions by default (injected into system prompt)
- `load_skill("visualization")` loads full skill content on demand
- `load_skill("visualization/interactive_charts")` loads a sub-skill
- For basic charts, `run_python()` is called directly (no skill loading needed — avoids multi-step tool chain issues with small models)
- Skills are auto-discovered from `backend/app/skills/` directory

### Sandbox Helpers (available inside `run_python`)
- `_db` — pre-connected DuckDB instance
- `print_full(df)` — print DataFrame without truncation
- `save_table_html(df, title)` — save table as HTML artifact
- `save_chart_vegalite(chart, title)` — save Altair chart as Vega-Lite artifact
- `styled_chart(chart, title, width, height)` — apply dark theme to Altair charts

### Whitelisted Packages
pandas, numpy, matplotlib, seaborn, plotly, scipy, scikit-learn, statsmodels, duckdb, altair, vl-convert

---

## UI Layout (3-Panel)

- **Left (260px, resizable)**: Logo, model selector, file upload, dataset list with schema
- **Center (flex)**: Chat with fun randomized text (changes every refresh)
- **Right (340px, resizable)**: Tabs — Progress + Artifacts | Workspace | Trace

### Frontend Architecture Notes
- **Zustand selectors**: Components subscribe to individual store fields, not the whole store, to prevent re-render cascades during SSE streaming
- **useChat hook**: Provides actions (`sendMessage`, `clearMessages`, `stopGeneration`). State is read directly from `useChatStore` selectors in each component
- **Token streaming**: `token_delta` SSE events append tokens incrementally via `appendToken()`. Full `message` event is authoritative fallback.
- **Stop generation**: `AbortController` aborts the fetch. Escape key shortcut. Stop button replaces send button during streaming.
- **Message animations**: Framer Motion `AnimatePresence` for slide-up entrance of new messages
- **Typing cursor**: CSS `typing-cursor` class adds blinking cursor while assistant is streaming
- **Keyboard shortcuts**: Cmd+K (new chat), Escape (stop generation)
- **Agent transparency**: `thinking` events show planning steps and delegation in progress panel
- **Scroll**: Uses `requestAnimationFrame` + `behavior: "instant"` (not smooth) to prevent scroll animation pileup
- **Flexbox overflow**: All flex-col containers have `overflow-hidden` + scrollable children have `min-h-0` to prevent layout thrashing

---

## Config

- `config/config.yaml` — LLM provider (default: ollama), model (default: qwen3.5:9b), agent mode (single/multi), ports, database path, sandbox
- `backend/sandbox-requirements.txt` — packages available in sandbox
- Environment: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `CONFIG_PATH`

---

## Code Conventions

- **Python**: ruff linting/formatting, `from __future__ import annotations` in all files, line-length 100
- **TypeScript**: strict mode, path aliases (@/ → src/), explicit null checks
- **Charts**: Prefer Altair over matplotlib → renders as interactive Vega-Lite
- **Streaming**: All agent output goes through SSE events, never polling
- **Fun text**: All UI copy is randomized per session via `frontend/src/lib/funText.ts`

---

## Commands

```bash
# Backend
cd backend && source .venv/bin/activate
uvicorn app.main:app --reload          # Dev server
pytest tests/ -v                        # Tests
ruff check --fix                        # Lint

# Frontend
cd frontend
npm run dev                             # Dev server
npm run build                           # Production build
npx vitest run                          # Tests
```

---

## Roadmap Enhancement Workflow

When implementing enhancements from `docs/roadmap.md`, follow this pattern:

1. **Read the roadmap** — identify items to implement (marked `[ yes ]` or prioritized by user)
2. **Explore the full codebase** — use Explore agents on both frontend and backend to get complete code context before making changes
3. **Create tasks** — use TaskCreate to track each enhancement as a discrete task
4. **Implement in dependency order**:
   - Backend changes first (new SSE events, API changes)
   - Frontend types/interfaces next
   - SSE handler (`sse.ts`) + store (`chatStore.ts`)
   - Hooks (`useChat.ts`)
   - Components (UI changes)
   - CSS animations last
5. **Type-check** — `npx tsc --noEmit` after frontend changes
6. **Fix tests** — update `__tests__/sse.test.ts` and `chatStore.test.ts` for new event types
7. **Build** — `npm run build` to catch bundling issues
8. **Run all tests** — backend `pytest tests/ -v`, frontend `npx vitest run`
9. **Start both servers** — backend on :8000, frontend on :5173
10. **E2E test** — `curl` the chat API to verify SSE events flow end-to-end
11. **Update docs** — roadmap (remove done items), CLAUDE.md (new features), design doc
12. **Mark tasks completed** — clean up task list

**Key rule**: Always implement backend → frontend → tests → docs. Never skip the E2E curl test.

---

## When Things Break

1. Check backend console + browser console (F12)
2. Check SSE events: Browser DevTools → Network → chat (EventStream)
3. Read the error message — it usually tells you what to do
4. Traces saved in `backend/traces/{session_id}/` for debugging (auto-cleaned after 3 days on server startup)
5. Use `python3 backend/trace_summary.py --last 1` to inspect recent traces

---

## Last Updated
2026-03-20 — Hierarchical skills system, single-agent mode with inline chart pattern, auto-cleanup of traces >3 days, trace_summary.py CLI tool, system prompt hardened for small models (qwen3.5:9b).
