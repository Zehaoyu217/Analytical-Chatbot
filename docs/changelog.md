# Changelog

## 2026-03-18 -- Pipeline Fix + Optimization

### Fixed
- Chat responses now display in UI (LangChain message serialization)
- DuckDB sandbox lock resolved (temp file copy approach)
- Artifacts flow end-to-end (sandbox charts/tables -> store -> SSE -> UI)
- Session context for tools (shared ContextVar, set by executor)

### Optimized
- Data context (schemas + sample rows) always in system prompt for ALL models
- Reduced LLM calls from 4+ to 1 per question (eliminated list_datasets/get_schema roundtrips)
- System prompt enforces anti-hallucination (must use tools for computation)

### Added
- Tool call logging (tool_calls_log in AgentState with name, args, result, elapsed time)
- Per-tool progress events via SSE (visible in Progress panel)
- qwen3:8b model for faster development testing
- Comprehensive documentation system (flat docs/ structure)

### Documentation
- Restructured docs from nested dirs (ARCHITECTURE/, WORKFLOW/, SKILLS/, DEV_LOG/) to flat layout
- 7 focused docs: architecture, setup, extending, debugging, changelog, roadmap, known-issues
- Updated CLAUDE.md to reference new doc paths

### Changed
- Skills updated: sql_analysis and data_profiling no longer instruct LLM to call discovery tools
- Router keywords expanded: added mean, median, std, calculate to sql_analysis

## 2026-03-16 -- Initial Implementation

### Added
- Project scaffolding: FastAPI backend, React 19 frontend, config
- LangGraph agent: router -> skill_loader -> executor -> responder
- 8 skills: sql_analysis, visualization, data_profiling, statistical_test, trend_analysis, data_cleaning, research_report, dashboard
- DuckDB data layer: ingestion, catalog, query execution
- Python sandbox: subprocess + AST validator + helpers
- LLM providers: Ollama, OpenAI, Anthropic, Google via LangChain
- 3-panel UI: sidebar (upload/datasets), chat, workspace (progress/artifacts/dashboard)
- SSE streaming: progress, artifact, dashboard, message events
- Artifact system: tables (HTML), charts (Vega-Lite), diagrams (Mermaid)
