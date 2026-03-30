# Roadmap

## Vision

A full-stack analytical platform where users upload data and interact with an AI analyst that can do everything a data scientist does: explore, clean, model, visualize, test hypotheses, and generate reports. Multiple specialized agents collaborate via A2A, with full transparency via A2UI streaming.

## Current State

**Fully implemented:**
- Deep agents (LangChain deepagents SDK) with planning, sub-agent delegation, middleware
- 4 sub-agents: data_profiler, sql_analyst, visualizer, researcher
- EventBus A2UI streaming (tool_start/end, agent_status, progress, artifacts)
- Token-level streaming (typing effect in UI)
- Auto-save artifacts (query_duckdb auto-saves HTML tables)
- Stop generation (AbortController + Escape key)
- Keyboard shortcuts (Cmd+K new chat, Escape stop)
- Agent thinking transparency (planning steps, delegation events)
- Message entrance animations (Framer Motion)
- Typing cursor animation while streaming
- Progress panel with hierarchical agent/tool timeline
- Fun randomized UI text (changes every refresh)
- Skills system (Markdown + YAML frontmatter)
- Sandboxed Python execution (AST validation + subprocess)
- Model support: tool-capable (qwen3) + reasoning (deepseek-r1)

---

## Near-Term (Next)

### Robustness
- [ ] Error recovery: agent retries with different approach on tool failure
- [ ] Input validation: sanitize user messages, file uploads
- [ ] Session persistence: save conversations to disk for replay
- [ ] Rate limiting on API endpoints
- [ ] Graceful handling of Ollama/LLM service unavailability

### Skills Expansion
- [ ] **Feature engineering**: create new columns, binning, encoding, scaling
- [ ] **ML modeling**: train/evaluate simple models (linear reg, classification, clustering)
- [ ] **Anomaly detection**: statistical and ML-based outlier identification
- [ ] **Comparison analysis**: compare groups, A/B test results, cohort analysis
- [ ] **Geospatial**: basic map visualizations if lat/lon columns exist

### UX Enhancements
- [ ] Conversation history: persist and browse past sessions
- [ ] Artifact management: rename, delete, export artifacts
- [ ] Multi-dataset joins: let the agent work across uploaded tables
- [ ] Shareable dashboards: export workspace as standalone HTML
- [ ] Scroll-to-bottom FAB when user scrolls up during streaming
- [ ] Copy message content button on assistant messages
- [ ] Collapsible long code blocks in messages

---

## Medium-Term

### Agent Intelligence
- [ ] **Memory across sessions**: agent remembers user preferences and past analyses
- [ ] **Self-evaluation**: agent checks its own output quality before responding
- [ ] **Capability-aware routing**: LLM embedding similarity for smarter delegation
- [ ] **Artifact versioning**: track changes to artifacts over time with branching

### Data Platform
- [ ] **Database connectors**: PostgreSQL, MySQL, BigQuery, Snowflake
- [ ] **Streaming data**: support for real-time data sources
- [ ] **Large dataset handling**: sampling strategies for 1M+ row datasets

### A2A Protocol Compliance
- [ ] **Agent Cards endpoint**: `GET /.well-known/agent-card.json` for discovery
- [ ] **Full task lifecycle**: SUBMITTED → WORKING → COMPLETED/FAILED/INPUT_REQUIRED
- [ ] **Async task submission**: fire-and-forget with polling for long analyses
- [ ] **External agent federation**: connect to other A2A agents over HTTP

### Human-in-the-Loop
- [ ] **Approval gates**: pause before sensitive operations (file writes, exports)
- [ ] **Checkpointing & time travel**: rewind and branch analysis paths
- [ ] **Interactive widgets**: sliders/filters that re-query data

### Infrastructure
- [ ] **Docker deployment**: containerized backend + frontend
- [ ] **Authentication**: user accounts, API keys
- [ ] **Sandbox hardening**: Docker/gVisor sandbox for production
- [ ] **Caching**: cache LLM responses for identical queries
- [ ] **Persistent state**: AsyncPostgresSaver for session resumption
- [ ] **Metrics middleware**: track tool latency, token counts, cost

---

## Long-Term

### Production
- [ ] Multi-tenant with user isolation
- [ ] Audit logging for compliance
- [ ] Model registry for trained ML models
- [ ] Scheduled reports / automated analyses
- [ ] Plugin system for custom tools and skills
- [ ] Token budget enforcement (RateLimitMiddleware)
- [ ] Query result caching (CacheMiddleware)
