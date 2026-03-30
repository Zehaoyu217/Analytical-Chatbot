# Framework Enhancement Plan
## Harness Engineering · ACI · Context Management

**Date**: 2026-03-25 (revised after dependency analysis)
**Status**: Sprint 1 ✅ + Sprint 2 ✅ + Sprint 3 (C1, A3) ✅ — Implemented 2026-03-25
**Scope**: Deep enhancement of the agentic scaffolding, ACI tooling, and context management

> **Sub-agent enhancements (H4 expanded roster, H5 supervisor routing) are deferred.**
> Current preference: single-agent mode hardened with stronger harness/ACI/context primitives.
> Multi-agent patterns revisited after the single-agent loop is fully robust.

---

## The Mental Experiment: A 150-Tool-Call Deep Analysis

Before speccing anything, simulate the worst case — a real deep analytical task:

**Request**: *"Full EDA on the macro dataset. Profile all columns, run correlations, identify outliers, build a GDP prediction model, evaluate it, then produce an executive dashboard with key insights."*

### What actually happens across 150+ tool calls:

**Phase 1 — Planning & Discovery (calls 1–8)**
- `write_todos` → 6-phase plan created, stored in messages
- `list_datasets` → table names
- `get_schema(us_macro)` → 14 columns, types, note: gdp in trillions not billions
- 5× `query_duckdb` → row counts, date ranges, basic distributions

**Phase 2 — EDA (calls 9–45)**
- 15× `run_python` for: null analysis, distributions, outlier detection, correlation matrix, time series plots
- Each generates: 500–2000 chars of stdout + 1–3 artifacts saved
- 4× `write_todos` updates as sub-steps complete
- 2× `run_python` failures, each with retry → error + correction cycle
- `get_schema` called again at step 28 (agent forgot column names)

**Phase 3 — Feature Engineering (calls 46–75)**
- 12× `run_python`: log transforms, lag features, rolling averages, encoding
- Variables built: `df_clean`, `df_features`, `df_train`, `df_test`
- `write_todos` updated 3 more times
- 3× failures: shape mismatch, NaN propagation, index alignment

**Phase 4 — Modeling (calls 76–115)**
- 8× `run_python`: linear regression, ridge, lasso, ARIMA, cross-validation
- Each model: fit → evaluate → save results
- `_persist_model_lr`, `_persist_model_ridge` created
- 5× failures: wrong feature shapes, singular matrix, convergence warnings
- `write_todos` refined — 2 new sub-steps added mid-flight
- At call ~100: **the agent calls `get_schema` a third time** — it forgot the column names again

**Phase 5 — Visualization (calls 116–135)**
- 8× `run_python` for charts: GDP time series, unemployment scatter, residual plots
- Each chart: load `_db`, query, build Altair chart, `gs_theme()`, `save_artifact()`

**Phase 6 — Synthesis (calls 136–150)**
- Agent generates narrative, builds dashboard, writes summary
- **Problem**: agent has forgotten what specific findings were from Phase 2 EDA
- **Problem**: it doesn't know which model won (ridge vs linear)
- **Problem**: it re-states the GDP column as "billions" — the Phase 1 finding is gone

### The Failure Points (what breaks right now)

| Step Range | What Gets Compacted | What the Agent Loses |
|---|---|---|
| 11–20 (first 10 tool results lost) | Phase 1 schema results | Column names, units (gdp in trillions!) |
| 21–40 | EDA stdout, correlation values | Key quantitative findings |
| 41–60 | Feature engineering code/results | Which transforms were applied, variable names |
| 61–80 | Model training outputs | Which model parameters, R² values |
| 81–100 | Error/retry cycles | What mistakes were already tried and failed |
| 101+ | plan write_todos from step 1 | Original phase structure, which steps remain |

**The core problem**: LangGraph `messages` is the ONLY persistence layer. Everything — plans, findings, variable names, model results, schema, errors — lives in the message list and gets progressively truncated. By step 100, the agent is effectively amnesiac about the first half of its work.

---

## The Fundamental Architecture Change: Dual Persistence

The entire enhancement plan revolves around one architectural insight:

**Message history is RAM. It must be complemented by a disk-like persistent layer.**

```
┌─────────────────────────────────────────────────────────────────┐
│  AGENT TURN N (e.g. step 100 of 150)                           │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  PERSISTENT STATE (injected every turn, never truncated) │   │
│  │  • Schema: {us_macro: [year, gdp_trillions, unemp, ...]} │   │
│  │  • Plan: Phase 1 ✅, Phase 2 ✅, Phase 3 🔄 (step 2/4)  │   │
│  │  • Findings: ["GDP peaked 2019 $21.4T", "corr=-0.73"]   │   │
│  │  • Python NS: [df_clean(1247r), _persist_model_ridge]    │   │
│  │  • Artifacts: [a1:GDP chart, a2:corr heatmap, a3:table]  │   │
│  │  • Errors resolved: ["gdp→gdp_trillions", "+LIMIT 1000"] │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌────────────────────────────────────────────┐                 │
│  │  MESSAGE HISTORY (last N tool results)     │                 │
│  │  • Phase 2 summary: "EDA complete, 5 arti" │                 │
│  │  • Phase 3 summary: "Features built, df_c" │                 │
│  │  • [recent 10 tool calls in full]          │                 │
│  └────────────────────────────────────────────┘                 │
│                                                                  │
│  ┌──────────────────────────────────┐                           │
│  │  FILESYSTEM ARCHIVE              │                           │
│  │  /tmp/session_abc/               │                           │
│  │    query_014.txt (4200 chars)    │                           │
│  │    run_python_031.txt (8900c)    │                           │
│  │    model_summary.txt (12000c)    │                           │
│  │    [all tool results, full text] │                           │
│  └──────────────────────────────────┘                           │
└─────────────────────────────────────────────────────────────────┘
```

**Every enhancement in this plan either:**
1. Feeds information INTO the persistent state (so it's never lost), OR
2. Keeps the message history lean and coherent, OR
3. Makes the ACI safer and more informative so fewer retries are needed

---

## Dependency Graph

Implementation order matters. This graph shows what must exist before each enhancement:

```
H1 (EvaluatorMiddleware)  ─────────────────────────────────────── [standalone]
H2 (Plan Validation)      ─────────────────────────────────────── [standalone]
A2 (Ruff Pre-Lint)        ─────────────────────────────────────── [standalone]
A5 (Schema Error Injection) ───────────────────────────────────── [standalone]
A6 (Output Size Guard)    ─────────────────────────────────────── [standalone]

H5 (Persistent Agent State) ───────────────────────────────────── [standalone, but BLOCKS:
    ↳ C3 (Key Findings Bulletin)     requires H5's write mechanism
    ↳ C4 (Variable Registry)         requires H5's write mechanism
    ↳ C2 (Phase-Boundary Compaction) requires H5's plan state
    ↳ A3 (Object Persistence)        shares session dir with H5

H6 (Checkpoint Persistence / SQLite saver) ──────────────────── [standalone, enables:
    ↳ C6 (Schema Delta Injection)    requires state update API

A1 (DataFrame Interceptor) ────────────────────────────────────── [standalone]
A3 (Object Persistence)    ──── after H5 (session dir already exists)
A4 (view_data tool)        ─────────────────────────────────────── [standalone]

C1 (Filesystem Offloading) ──── after H5 (session dir), enables:
    ↳ C2 (Phase Compaction)  references offloaded result files
    ↳ read_result tool

C2 (Phase-Boundary Compaction) ─ after H5 + C1
C4 (Variable Registry)     ─── after H5 + A3

I1 (Metrics Middleware)    ─────────────────────────────────────── [standalone]
I4 (Skill Hot-Reload)      ─────────────────────────────────────── [standalone]
I2 (Docker Sandbox)        ──── after A3 (shares session dir)
```

**Correct implementation sequence**:
1. Standalone safety improvements: H1, H2, A2, A5, A6 (no deps)
2. Foundation layer: **H5** (Persistent Agent State) — everything else builds on this
3. Storage layer: H6 (checkpoint), C1 (filesystem offloading), A3 (object persistence)
4. Intelligence layer: C2 (phase compaction), C3 (findings), C4 (variable registry), A1 (DataFrame interceptor)
5. Tools layer: A4 (view_data), read_result tool
6. Observability: I1, I4

---

## Current State Baseline

| Area | Feature | File | Status |
|------|---------|------|--------|
| Harness | `write_todos` planning (deepagents SDK) | `system_prompt.md` | ✅ Exists |
| Harness | `ToolResultCompactionMiddleware` (keep last 10, first-line truncate) | `deep_agent.py:205` | ✅ Crude but working |
| Harness | `EventBusMiddleware` (tool_start/end streaming) | `deep_agent.py:141` | ✅ Exists |
| Harness | 2 sub-agents in multi mode (analyst, visualizer) | `deep_agent.py:280` | ✅ Deferred for now |
| Harness | Sub-agent output polishing via Ollama | `llm/polisher.py` | ✅ Exists |
| ACI | AST validation before sandbox | `sandbox/validator.py` | ✅ Exists |
| ACI | WAL CHECKPOINT before DuckDB copy | `sandbox/executor.py:68` | ✅ Exists |
| ACI | JSON escape sanitization (`"}` stripping) | `run_python.py:39` | ✅ Exists |
| ACI | Error hint injection (KeyError, ImportError) | `run_python.py:52` | ✅ Partial |
| ACI | `print_full()` for DataFrames | `sandbox/runner.py` | ✅ No limit/pagination |
| Context | Schema + 5-row samples in system prompt | `deep_agent.py:59` | ✅ Exists |
| Context | Agent cache keyed by model+provider+mode | `deep_agent.py:386` | ✅ Exists |
| Context | ToolResultCompactionMiddleware (max_keep=10) | `deep_agent.py:213` | ⚠️ Crude first-line truncation |

**What is entirely missing**: persistent agent state, phase tracking, findings registry, variable registry, filesystem archiving of tool results, pre-execution linting, stateful sandbox objects.

---

## Part 1: Harness Engineering

### H1 · Smart Error Recovery (EvaluatorMiddleware)

**Gap**: Error hints in `run_python.py` are appended to tool results after the fact. The agent sees them, but by the time it processes the next step, this context may already be compacted. Additionally, many analytical errors follow predictable patterns that a rule engine can diagnose better than the model can in isolation.

**Enhancement**: A middleware that runs in `before_agent()` and inspects the last ToolMessage. If it finds an error, it injects a structured correction hint as a system annotation *before* the next agent step — making the hint part of the agent's pre-step context:

```python
import re
from langchain_core.messages import ToolMessage
from langgraph.types import Overwrite

class EvaluatorMiddleware(AgentMiddleware):
    """Pattern-matched error → targeted hint injected before next agent step."""

    PATTERNS = [
        (r"KeyError|ColumnNotFoundError|column.*not found",
         "SCHEMA_MISMATCH — The column name is wrong. Call get_schema() before retrying."),
        (r"NaN|null|missing values|fillna",
         "NULL_VALUES — Dataset has NaNs. Try df.dropna() or df.fillna(0) first."),
        (r"MemoryError|Killed|OOM|out of memory",
         "MEMORY — DataFrame too large. Add LIMIT to SQL or sample: df.sample(10_000)."),
        (r"shape.*(mismatch|incompatible)|broadcast|cannot reshape",
         "SHAPE — Array dimensions don't align. Print df.shape and X.shape before operations."),
        (r"TimeoutExpired|timed out",
         "TIMEOUT — Too slow. Move aggregations to query_duckdb (DuckDB is 100× faster than pandas for GROUP BY)."),
        (r"model\.summary\(\)|model\.params.*\n.{500,}",
         "MASSIVE OUTPUT — Never print model.summary(). Print specific fields: model.rsquared, dict(model.params)."),
        (r"SingularMatrixError|singular|LinAlgError",
         "SINGULAR MATRIX — Features are perfectly collinear. Drop one correlated feature or add regularization."),
        (r"ConvergenceWarning|did not converge",
         "CONVERGENCE — Model did not converge. Increase max_iter=1000 or scale features with StandardScaler first."),
        (r"Code executed successfully.*no output|^$",
         "EMPTY OUTPUT — Nothing printed. Add print() statements to see results."),
        (r"Saved.*artifact.*\nSaved.*artifact.*\nSaved.*artifact",
         "MULTIPLE ARTIFACTS — Good. Do NOT reproduce this data as markdown. Write analytical observations only."),
    ]

    def before_agent(self, state, runtime):
        messages = state.get("messages", [])
        last_tool = next(
            (m for m in reversed(messages) if isinstance(m, ToolMessage)), None
        )
        if not last_tool:
            return None
        content = last_tool.content if isinstance(last_tool.content, str) else str(last_tool.content)

        for pattern, hint in self.PATTERNS:
            if re.search(pattern, content, re.IGNORECASE | re.DOTALL):
                compacted = list(messages)
                tool_idx = len(messages) - 1 - next(
                    i for i, m in enumerate(reversed(messages))
                    if isinstance(m, ToolMessage)
                )
                original = compacted[tool_idx]
                compacted[tool_idx] = ToolMessage(
                    content=f"[EVALUATOR → {hint}]\n\n{content}",
                    tool_call_id=original.tool_call_id,
                    name=getattr(original, "name", None),
                )
                return {"messages": Overwrite(compacted)}
        return None
```

**Impact on existing code**: Additive — new middleware added to the `middleware` list in `build_deep_agent()`. No other changes. Runs only when last ToolMessage has an error, so zero overhead on happy path.

**Priority**: P1 | **Difficulty**: Low | **File**: `deep_agent.py`

---

### H2 · Plan Validation Against Real Schema

**Gap**: The agent writes todos like "Compute rolling average of revenue" after only seeing the schema in the system prompt — which has 5-row samples but may not surface column naming subtleties. The plan looks fine but the column doesn't exist or has a different name.

**Enhancement**: In `EventBusMiddleware.awrap_tool_call`, after the `write_todos` result is returned, parse the plan text for table names and column references. Validate against the live DuckDB schema. Append warnings to the tool result so the agent self-corrects immediately.

```python
async def _validate_plan(plan_text: str) -> list[str]:
    """Check plan for obviously invalid column/table references."""
    warnings = []
    db = get_duckdb()
    catalog = get_catalog()
    all_tables = {ds["table_name"] for ds in catalog.list_datasets()}
    all_columns = {}
    for tname in all_tables:
        schema = db.get_table_schema(tname)
        all_columns[tname] = {c["name"].lower() for c in schema}

    import difflib
    # Find quoted identifiers in the plan text that look like column names
    col_refs = re.findall(r'`([a-z_]+)`', plan_text.lower())
    for ref in set(col_refs):
        found_in_any = any(ref in cols for cols in all_columns.values())
        if not found_in_any:
            # Find closest match across all tables
            all_col_names = [c for cols in all_columns.values() for c in cols]
            close = difflib.get_close_matches(ref, all_col_names, n=2, cutoff=0.7)
            warnings.append(
                f"  Column `{ref}` not found in any table."
                + (f" Did you mean: {close}?" if close else " Run get_schema() to check.")
            )
    return warnings

# In awrap_tool_call, after write_todos handler:
if tool_name == "write_todos":
    warnings = await _validate_plan(result_text)
    if warnings:
        result = ToolMessage(
            content=result_text + "\n\n[PLAN VALIDATOR warnings]:\n" + "\n".join(warnings),
            tool_call_id=result.tool_call_id,
        )
```

**Impact**: Additive modification to `EventBusMiddleware`. No breaking changes.

**Priority**: P2 | **Difficulty**: Medium | **File**: `deep_agent.py`

---


### H5 · Persistent Agent State (The Load-Bearing Piece)

> **This is the single most important enhancement. Everything in C2, C3, C4 depends on it.**

**The Problem**: The agent loses critical state as messages are compacted. Schema column names, plan phase structure, key quantitative findings, variable names, resolved errors — all vanish from working memory in long sessions.

**The Solution**: A structured state object that lives OUTSIDE the message list. It is:
- Stored in a SQLite side-channel keyed by session_id (not in LangGraph messages)
- Updated by middleware after each relevant tool call
- Injected at the TOP of every `before_agent()` call as a compact SystemMessage
- Never truncated, always current

```python
import json, sqlite3
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Optional

@dataclass
class AgentPersistentState:
    schema: dict = field(default_factory=dict)
    # {"table": ["col1:TYPE", "col2:TYPE"]}

    plan_phases: list = field(default_factory=list)
    # [{"name": "EDA", "status": "done", "findings": ["GDP peaked 2019"], "steps": [...]}]

    findings: list = field(default_factory=list)
    # Running list of key discoveries the agent explicitly recorded

    python_namespace: list = field(default_factory=list)
    # ["df_clean (1247 rows, macro data preprocessed)", "_persist_model_ridge (fitted RidgeCV)"]

    artifacts: list = field(default_factory=list)
    # [{"id": "a1", "title": "GDP over Time", "type": "chart"}]

    errors_resolved: list = field(default_factory=list)
    # [{"error": "KeyError: gdp", "resolution": "Column is gdp_trillions"}]

    tool_call_count: int = 0


class PersistentStateStore:
    def __init__(self, db_path: str):
        self._conn = sqlite3.connect(db_path, check_same_thread=False)
        self._conn.execute("""
            CREATE TABLE IF NOT EXISTS agent_state
            (session_id TEXT PRIMARY KEY, state_json TEXT, updated_at REAL)
        """)
        self._conn.commit()

    def load(self, session_id: str) -> AgentPersistentState:
        row = self._conn.execute(
            "SELECT state_json FROM agent_state WHERE session_id = ?", (session_id,)
        ).fetchone()
        if row:
            return AgentPersistentState(**json.loads(row[0]))
        return AgentPersistentState()

    def save(self, session_id: str, state: AgentPersistentState) -> None:
        self._conn.execute(
            "INSERT OR REPLACE INTO agent_state VALUES (?, ?, ?)",
            (session_id, json.dumps(asdict(state)), time.time())
        )
        self._conn.commit()


class PersistentStateMiddleware(AgentMiddleware):
    """Maintains a compact structured state outside message history.

    Injected every turn as a SystemMessage. Never truncated.
    Updated after write_todos, get_schema, run_python, save_artifact calls.
    """

    def __init__(self, store: PersistentStateStore):
        self._store = store

    def _format_state(self, state: AgentPersistentState) -> str:
        """Format state as a compact agent-readable block."""
        lines = ["[PERSISTENT STATE — always current, never truncated]"]

        if state.schema:
            lines.append("Schema:")
            for tname, cols in state.schema.items():
                lines.append(f"  {tname}: [{', '.join(cols[:8])}{'...' if len(cols) > 8 else ''}]")

        if state.plan_phases:
            lines.append("Plan:")
            for ph in state.plan_phases:
                status_icon = {"done": "✅", "in_progress": "🔄", "pending": "⏳"}.get(ph.get("status"), "·")
                lines.append(f"  {status_icon} Phase: {ph['name']} ({ph.get('status', '?')})")
                for step in ph.get("steps", []):
                    s_icon = {"done": "  ✅", "in_progress": "  🔄", "pending": "  ⏳"}.get(step.get("status"), "  ·")
                    lines.append(f"{s_icon} {step['label']}")
                if ph.get("findings"):
                    lines.append(f"    Key findings: {'; '.join(ph['findings'])}")

        if state.findings:
            lines.append("Recorded findings:")
            for f in state.findings[-10:]:  # last 10 findings
                lines.append(f"  • {f}")

        if state.python_namespace:
            lines.append("Python namespace (persisted across calls):")
            for v in state.python_namespace:
                lines.append(f"  • {v}")

        if state.artifacts:
            lines.append(f"Artifacts created ({len(state.artifacts)}):")
            for a in state.artifacts[-5:]:
                lines.append(f"  [{a['type']}] {a['title']} (id={a['id']})")

        if state.errors_resolved:
            lines.append("Errors already resolved (do not repeat these mistakes):")
            for e in state.errors_resolved[-5:]:
                lines.append(f"  • {e['error']} → {e['resolution']}")

        lines.append(f"[Tool call #{state.tool_call_count}]")
        return "\n".join(lines)

    def before_agent(self, state, runtime):
        """Inject persistent state as the first SystemMessage every turn."""
        session_id = current_session_id.get()
        if not session_id:
            return None

        ps = self._store.load(session_id)
        state_text = self._format_state(ps)

        messages = list(state.get("messages", []))
        from langchain_core.messages import SystemMessage

        # Replace any existing persistent state injection (keep only latest)
        STATE_MARKER = "[PERSISTENT STATE"
        messages = [
            m for m in messages
            if not (isinstance(m, SystemMessage) and m.content.startswith(STATE_MARKER))
        ]
        # Inject fresh state after the first SystemMessage (system prompt)
        insert_at = next(
            (i + 1 for i, m in enumerate(messages) if isinstance(m, SystemMessage)), 0
        )
        messages.insert(insert_at, SystemMessage(content=state_text))
        return {"messages": Overwrite(messages)}

    async def awrap_tool_call(self, request, handler):
        session_id = current_session_id.get()
        result = await handler(request)
        if not session_id:
            return result

        ps = self._store.load(session_id)
        ps.tool_call_count += 1

        tc = request.tool_call
        tool_name = tc.get("name", "") if isinstance(tc, dict) else getattr(tc, "name", "")
        args = tc.get("args", {}) if isinstance(tc, dict) else getattr(tc, "args", {})
        result_text = result.content if hasattr(result, "content") else str(result)

        # Update schema cache after get_schema calls
        if tool_name == "get_schema":
            tname = args.get("table_name", "")
            if tname and "Columns:" in result_text:
                import re
                cols = re.findall(r'`([^`]+)`:\s*(\w+)', result_text)
                ps.schema[tname] = [f"{n}:{t}" for n, t in cols]

        # Update plan structure from write_todos
        if tool_name == "write_todos":
            # Parse the structured plan if it's JSON, else store raw
            try:
                plan_data = json.loads(args.get("todos", "[]"))
                # Merge with existing phases if structured
                # (simple heuristic: if item has 'phase' key)
                if plan_data and isinstance(plan_data[0], dict) and "phase" in plan_data[0]:
                    ps.plan_phases = plan_data
            except (json.JSONDecodeError, IndexError, KeyError):
                pass  # write_todos format varies by model, don't crash

        # Track artifacts
        if tool_name in ("save_artifact", "query_duckdb") and "id=" in result_text:
            import re
            m = re.search(r'id=([a-z0-9\-]+)', result_text)
            title_m = re.search(r'artifact: (.+?) \(id=', result_text)
            type_m = re.search(r'(chart|table|diagram) artifact', result_text)
            if m:
                ps.artifacts.append({
                    "id": m.group(1),
                    "title": title_m.group(1) if title_m else "Artifact",
                    "type": type_m.group(1) if type_m else "artifact",
                })

        # Track resolved errors
        if "Error:" in result_text and "FIX" in result_text.upper():
            import re
            err = re.search(r'Error: ([^\n]{1,80})', result_text)
            if err:
                ps.errors_resolved.append({
                    "error": err.group(1),
                    "resolution": "see tool call history"
                })

        self._store.save(session_id, ps)
        return result
```

**Additionally**: Add a `record_finding` tool the agent can call explicitly:

```python
@tool
def record_finding(finding: str, phase: str = "") -> str:
    """Record an important insight into the persistent findings bulletin.

    Use this whenever you discover something significant:
    - Key statistical result: "GDP correlation with unemployment: -0.73 (strong negative)"
    - Data quality note: "gdp column is in trillions, not billions"
    - Model result: "Ridge regression outperforms linear (R²=0.81 vs 0.74)"
    - Decision made: "Excluded 2008-2009 from training set (financial crisis outlier)"

    These findings persist for the ENTIRE session — they will still be visible at step 200.
    """
    session_id = current_session_id.get()
    ps = _persistent_store.load(session_id)
    entry = f"[{phase}] {finding}" if phase else finding
    ps.findings.append(entry)
    _persistent_store.save(session_id, ps)
    return f"Finding recorded: {entry}"
```

Add `record_finding` to `AGENT_TOOLS` and system prompt. Tell agent to use it after EDA findings, model results, and data quality discoveries.

**Impact**:
- New `PersistentStateStore` class (SQLite, same file as checkpoints)
- New `PersistentStateMiddleware` added to middleware list
- New `record_finding` tool added to AGENT_TOOLS
- System prompt gains a short section on when to call `record_finding`
- Config gains `agent.persistent_state_db` path

**Priority**: P1 (must be done before C2, C3, C4) | **Difficulty**: Medium | **File**: `deep_agent.py`, `tools/record_finding.py`

---

### H6 · LangGraph Checkpoint Persistence (Session Resume + Time Travel)

**Gap**: `MemorySaver` is in-memory only. Server restart loses all session state.

**Enhancement**: Replace with `AsyncSqliteSaver`:

```python
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

# In build_deep_agent() — note: AsyncSqliteSaver is used as async context manager
# but deepagents' create_deep_agent is sync, so use the sync version:
from langgraph.checkpoint.sqlite import SqliteSaver
checkpointer = SqliteSaver.from_conn_string(str(cfg.data.checkpoints_path))
```

This enables:
1. **Session resume**: same `thread_id` → pick up exactly where left off
2. **Time travel**: `agent.get_state_history(config)` → rewind to any checkpoint
3. **Crash recovery**: server restart doesn't lose session

**Important**: The `AgentPersistentState` (H5) uses a SEPARATE SQLite connection (not the LangGraph checkpoint DB) because LangGraph checkpoints are append-only and not designed for partial key updates.

**Frontend**: Add "Rewind to step N" to the Trace panel (`POST /api/sessions/{id}/rewind?checkpoint={id}`).

**Impact**: 1-line change in `build_deep_agent()`. The SQLite file already exists (`backend/data/checkpoints.sqlite`). Sessions API needs a new `rewind` endpoint.

**Priority**: P2 | **Difficulty**: Medium | **File**: `deep_agent.py`, `api/sessions.py`

---

## Part 2: ACI (Agent-Computer Interface)

### A1 · Smart DataFrame Interceptor (Pagination)

**Gap**: `print(df)` with 1000 rows → 15,000 chars of context noise.

**Enhancement**: Override `print` in RUNNER_TEMPLATE. Any DataFrame > 20 rows gets auto-summarized:

```python
_original_print = print
def print(*args, **kwargs):
    import pandas as _pd
    if len(args) == 1 and isinstance(args[0], _pd.DataFrame):
        df = args[0]
        n_rows, n_cols = df.shape
        if n_rows > 20:
            _original_print(f"DataFrame({n_rows:,} rows × {n_cols} cols)")
            _original_print(f"Columns: {list(df.columns)}")
            nulls = df.isnull().sum()
            if nulls.any():
                _original_print(f"Nulls: {dict(nulls[nulls > 0])}")
            num = df.select_dtypes(include='number')
            if not num.empty:
                _original_print(f"Numeric stats:\n{num.describe().round(3).to_string()}")
            _original_print(f"First 5 rows:\n{df.head(5).to_string()}")
            _original_print(f"[Full view: print_full(df, max_rows=N)]")
            return
    _original_print(*args, **kwargs)
```

**Interaction with H5**: When A1 summarizes a DataFrame, the agent should call `record_finding()` with the key statistics rather than relying on the tool result being available later.

**Priority**: P1 | **Difficulty**: Low | **File**: `sandbox/runner.py`

---

### A2 · Pre-Execution Ruff Linting

**Gap**: AST validation catches forbidden imports and syntax errors but not semantic issues: undefined variables (NameError), wrong pandas API usage, calling `.predict()` before `.fit()`.

**Enhancement**: Run `ruff check` on code before subprocess execution. Only block on `F`-class (pyflakes) errors — undefined names are the main culprit:

```python
def _ruff_lint(code: str) -> Optional[str]:
    """Run ruff on code string. Returns error message or None."""
    import subprocess, shutil
    if not shutil.which("ruff"):
        return None  # ruff not installed, skip
    r = subprocess.run(
        ["ruff", "check", "--select", "F821,F841,E999", "--output-format", "json", "-"],
        input=code.encode(), capture_output=True, timeout=5,
    )
    if r.returncode == 0:
        return None
    try:
        issues = json.loads(r.stdout)
        critical = [i for i in issues if i["code"] in ("F821", "E999")]
        if not critical:
            return None
        lines = [f"  Line {i['location']['row']}: [{i['code']}] {i['message']}" for i in critical[:3]]
        return "Pre-execution lint:\n" + "\n".join(lines) + "\nFix and retry."
    except Exception:
        return None
```

**Key rules**: `F821` (undefined name), `E999` (syntax error caught by ruff), `F841` (assigned but never used — optional).

**Note**: Do NOT lint for style (`E` rules beyond `E999`) — the agent doesn't care about PEP 8 and it creates noise.

**Priority**: P2 | **Difficulty**: Low | **File**: `sandbox/executor.py`

---

### A3 · Stateful Object Persistence Between Sandbox Calls

**Gap**: Every `run_python` is a fresh subprocess. A trained model from call #50 can't be used in call #65 — forcing the agent to either re-train (slow) or pack everything into one massive script (fragile).

**Enhancement**: Session-scoped temp directory with joblib serialization.

**Mechanism**:
- Variables named `_persist_*` at end of code → auto-serialized to `/tmp/sandbox_{session_id}/`
- At start of each new sandbox call → auto-loaded from that directory
- Integrates with H5: after persist, the variable name + description is registered in `PersistentState.python_namespace`

```python
# Auto-persist at end of RUNNER_TEMPLATE:
_session_dir = f"/tmp/sandbox_{os.environ.get('SESSION_ID', 'nosession')}"
_persist_log = []
for _k, _v in list(locals().items()):
    if _k.startswith("_persist_"):
        try:
            import joblib as _jl, os as _os
            _os.makedirs(_session_dir, exist_ok=True)
            _path = f"{_session_dir}/{_k}.pkl"
            _jl.dump(_v, _path)
            _persist_log.append(f"{_k} → {_path}")
        except Exception as _pe:
            print(f"Warning: could not persist {_k}: {_pe}", file=sys.stderr)

if _persist_log:
    _result["stdout"] = _result.get("stdout", "") + \
        f"\n[Persisted: {', '.join(_persist_log)}]\n"

# Auto-load at start of RUNNER_TEMPLATE:
import glob as _glob, os as _os
_session_dir = f"/tmp/sandbox_{_os.environ.get('SESSION_ID', 'nosession')}"
for _pkl in _glob.glob(f"{_session_dir}/*.pkl"):
    _vname = _os.path.basename(_pkl).replace(".pkl", "")
    try:
        import joblib as _jl
        globals()[_vname] = _jl.load(_pkl)
    except Exception:
        pass
```

**Interaction with C1 (Filesystem Offloading)**: Both use `/tmp/sandbox_{session_id}/`. A3 stores Python objects (`.pkl`), C1 stores raw text (`.txt`). Same directory, different file types. Clean separation.

**Priority**: P2 | **Difficulty**: Medium | **File**: `sandbox/runner.py`, `sandbox/executor.py`

---

### A4 · Paginated Data View Tool (`view_data`)

**Gap**: No way to browse a large table without loading it into a DataFrame. Inspired by SWE-agent's `view_file(path, start_line, end_line)`.

**New Tool**:

```python
@tool
def view_data(
    table_name: str,
    start_row: int = 0,
    rows: int = 50,
    columns: str = "*",
    where: str = "",
    order_by: str = "",
) -> str:
    """Browse a table in pages. Use instead of SELECT * for exploration.

    Returns shape, column types, null counts, and `rows` rows starting at `start_row`.
    Navigate: call again with start_row=50 for next page.
    """
    rows = min(rows, 100)
    db = get_duckdb()
    total = db.execute_query_raw(f'SELECT COUNT(*) FROM "{table_name}"')["rows"][0][0]
    schema = db.get_table_schema(table_name)

    where_clause = f"WHERE {where}" if where else ""
    order_clause = f"ORDER BY {order_by}" if order_by else ""
    sql = f'SELECT {columns} FROM "{table_name}" {where_clause} {order_clause} LIMIT {rows} OFFSET {start_row}'
    result = db.execute_query_raw(sql)

    header = (
        f"Table: {table_name} | {total:,} rows total\n"
        f"Cols: {[f'{c[\"name\"]}:{c[\"type\"]}' for c in schema]}\n"
        f"Nulls: {_get_null_counts(table_name, db)}\n"
        f"Rows {start_row}–{start_row + len(result['rows']) - 1}:\n"
    )
    body = " | ".join(result["columns"]) + "\n"
    body += "\n".join(" | ".join(str(v) for v in row) for row in result["rows"])
    footer = f"\n[next page: start_row={start_row + rows}]" if start_row + rows < total else "\n[end of table]"
    return header + body + footer
```

Add to `AGENT_TOOLS`. This is especially useful for exploring new uploads before building queries.

**Priority**: P3 | **Difficulty**: Low | **File**: `tools/view_data.py`

---

### A5 · Schema-Aware Error Auto-Injection

**Gap**: `KeyError: 'revenue'` → agent must burn a separate `get_schema()` call to learn actual column names.

**Enhancement**: In `run_python.py`, when KeyError or AttributeError is detected, auto-query all schemas and suggest closest column names via `difflib`:

```python
if result.error and re.search(r"KeyError|AttributeError", result.error):
    key_match = re.search(r"KeyError: ['\"]([^'\"]+)['\"]", result.error)
    if key_match:
        bad_key = key_match.group(1)
        db = get_duckdb()
        all_cols = []
        all_schema_lines = []
        for ds in get_catalog().list_datasets():
            tname = ds["table_name"]
            schema = db.get_table_schema(tname)
            cols = [c["name"] for c in schema]
            all_cols.extend(cols)
            all_schema_lines.append(f"  {tname}: {cols}")

        import difflib
        close = difflib.get_close_matches(bad_key, all_cols, n=3, cutoff=0.5)
        parts.insert(0,
            f"COLUMN NOT FOUND: '{bad_key}'\nAll available columns:\n" +
            "\n".join(all_schema_lines) +
            (f"\nDid you mean: {close}?" if close else "")
        )
```

**Interaction with H5 schema cache**: If schema is already in persistent state, use that instead of querying DuckDB again. This saves a round-trip and also validates the cache is current.

**Priority**: P1 | **Difficulty**: Low | **File**: `tools/run_python.py`

---

### A6 · Output Size Guard (Pre-Execution)

**Gap**: `model.summary()`, `print(df)` on large datasets — the system prompt says don't but models still do it.

**Enhancement**: Scan code before execution for known high-volume patterns:

```python
OUTPUT_DANGER = [
    (r"model\.summary\(\)",
     "statsmodels model.summary() outputs ~3000 chars. Print: f'R²={model.rsquared:.4f}, AIC={model.aic:.1f}' instead."),
    (r"print\(\s*df\s*\)",
     "Printing bare DataFrame. Use print(df.head(10)) or print(df.describe())."),
    (r"for .+? in .+?\.iterrows\(\)",
     "iterrows() is O(n) Python loop — extremely slow. Use vectorized ops or .apply()."),
    (r"\.to_string\(\)\s*\)?\s*$",
     "df.to_string() dumps all rows. Prefer df.head(20).to_string() or df.describe()."),
]

def _output_danger_check(code: str) -> Optional[str]:
    for pattern, msg in OUTPUT_DANGER:
        if re.search(pattern, code, re.MULTILINE):
            return f"Output size guard: {msg}\nFix and retry."
    return None
```

**Priority**: P2 | **Difficulty**: Low | **File**: `sandbox/executor.py`

---

### A7 · Execution Profiling + Async Heartbeat

**Gap**: 45-second `run_python` calls give no feedback. User sees spinning cursor, no progress.

**Enhancement**: Async heartbeat that emits `tool_progress` SSE events during long runs:

```python
# In run_python.py:
async def _run_with_heartbeat(code: str, session_id: str, bus, timeout_s: int) -> SandboxResult:
    loop = asyncio.get_running_loop()
    heartbeat_seconds = [10, 30, 60, 120]
    elapsed = [0]

    async def heartbeat():
        for t in heartbeat_seconds:
            await asyncio.sleep(t - (elapsed[0] if elapsed else 0))
            elapsed[0] = t
            if bus:
                await bus.emit(session_id, AgentEvent(
                    type="tool_progress",
                    data={"message": f"Python still running... ({t}s elapsed)"},
                    agent_id="orchestrator",
                ))

    heartbeat_task = asyncio.create_task(heartbeat())
    try:
        result = await loop.run_in_executor(None, execute_python, code)
        return result
    finally:
        heartbeat_task.cancel()
```

**New SSE event**: `tool_progress` — handled by frontend to update the active tool_start card with "Still running..." text.

**Priority**: P3 | **Difficulty**: Medium | **File**: `tools/run_python.py`, `lib/sse.ts`, `stores/chatStore.ts`

---

## Part 3: Context Management

### C1 · Filesystem Offloading for Large Tool Results

**The canonical problem**: A 10,000-char SQL result goes into messages. The agent doesn't need most of it — it just needs to know the result was saved and what the key statistics were. But the full 10K chars sits in context burning tokens.

**Enhancement**: In `EventBusMiddleware.awrap_tool_call`, after every tool result, if content > threshold → write to file, return reference:

```python
OFFLOAD_THRESHOLD = 1500  # chars

async def _maybe_offload(content: str, session_id: str, tool_name: str) -> str:
    if len(content) <= OFFLOAD_THRESHOLD:
        return content

    session_dir = Path(f"/tmp/agent_results/{session_id}")
    session_dir.mkdir(parents=True, exist_ok=True)
    fname = f"{tool_name}_{int(time.time() * 1000)}.txt"
    fpath = session_dir / fname
    fpath.write_text(content)

    # Return compact reference with meaningful preview
    lines = content.split("\n")
    preview = "\n".join(lines[:4])
    return (
        f"[Result → {fpath} | {len(content)} chars | {len(lines)} lines]\n"
        f"Preview:\n{preview}\n"
        f"[read_result('{fpath}') to load full content]"
    )
```

Companion `read_result` tool:
```python
@tool
def read_result(path: str) -> str:
    """Load a previously offloaded tool result back into context.

    Use when you need to re-examine a large result from an earlier tool call.
    """
    try:
        content = Path(path).read_text()
        return content[:8000] + (f"\n...[truncated, {len(content)} total chars]" if len(content) > 8000 else "")
    except Exception as e:
        return f"Error: {e}"
```

**Impact**:
- Large tool results → compact references in message history (saves 80–90% of context chars for big queries)
- Full results always retrievable via `read_result`
- Session dir shared with A3 (Python object persistence) — same `/tmp/agent_results/{session_id}/` path

**Priority**: P2 (after H5 establishes session dir pattern) | **Difficulty**: Medium | **File**: `deep_agent.py`, new `tools/read_result.py`

---

### C2 · Phase-Aware Message Compaction

**Gap**: Current `ToolResultCompactionMiddleware` compacts by message count (keep last 10). This has no awareness of plan structure — it may compact a critical tool result from the current phase while keeping an irrelevant old one just because it's "recent."

**Revised Design**: Two-level compaction that respects phase boundaries:

**Level 1 (continuous)**: Replace the crude "keep last N full, truncate rest" with semantic importance scoring:

```python
def _importance_score(msg: ToolMessage, ps: AgentPersistentState) -> float:
    content = msg.content if isinstance(msg.content, str) else str(msg.content)
    score = 0.0

    # Always keep: planning and schema
    if getattr(msg, "name", "") in ("write_todos", "get_schema", "record_finding"):
        score += 5.0
    # Keep: artifact saves (agent may reference the ID)
    if "id=" in content and ("chart" in content or "table" in content):
        score += 3.0
    # Keep: recent errors (for reflexion)
    if "Error:" in content:
        score += 2.0
    # Keep: results from current plan phase (check against H5 phase state)
    current_phase = next((p for p in ps.plan_phases if p.get("status") == "in_progress"), None)
    if current_phase:
        score += 1.0  # slight boost for recent messages (will be recent naturally)
    # Discard: boilerplate successes
    if "executed successfully (no output)" in content or len(content) < 80:
        score -= 2.0
    # Discard: already offloaded (C1) — they're just references
    if "Result →" in content and "read_result" in content:
        score -= 1.0

    return score
```

**Level 2 (phase completion)**: When a plan phase transitions to "done" (detected from `write_todos` update parsed in H5), summarize ALL tool messages from that phase into a single compact summary message:

```python
async def _summarize_phase(phase_name: str, tool_messages: list[ToolMessage]) -> str:
    """Rule-based phase summary — no LLM call needed."""
    artifacts = [m for m in tool_messages if "id=" in (m.content or "")]
    errors = [m for m in tool_messages if "Error:" in (m.content or "")]
    tools_used = list({getattr(m, "name", "?") for m in tool_messages})

    return (
        f"[PHASE COMPLETE: {phase_name}]\n"
        f"Tools used: {tools_used}\n"
        f"Artifacts created: {len(artifacts)}\n"
        f"Errors encountered and resolved: {len(errors)}\n"
        f"[Full tool history offloaded to filesystem — use read_result() if needed]"
    )
```

**This is why H5 must come first**: Phase detection (when to trigger Level 2) reads from `PersistentState.plan_phases`. Without H5, there's no way to know a phase just completed.

**Priority**: P3 (requires H5) | **Difficulty**: High | **File**: `deep_agent.py`

---

### C3 · Key Findings Bulletin Board

**Part of H5** but described separately for clarity.

The `record_finding()` tool (introduced in H5) writes findings to `PersistentState.findings`. These are injected every turn. The agent is instructed to use this tool liberally:

**System prompt addition**:
```markdown
### Findings Bulletin
After any significant discovery — statistical result, data quality issue, model outcome, or
decision made — call `record_finding(finding, phase)`. These findings persist for the ENTIRE
session and will be visible at step 200. Examples:
- record_finding("GDP column is in TRILLIONS (×10^12), not billions", "EDA")
- record_finding("Unemployment correlates with GDP at r=-0.73 (p<0.001)", "EDA")
- record_finding("Ridge regression outperforms linear: R²=0.81 vs 0.74", "Modeling")
- record_finding("Excluded 2008–2009 as financial crisis outlier (n=8 quarters)", "Modeling")
```

**Why this matters**: Without explicit finding recording, the agent relies on memory of compressed tool results. With `record_finding`, the agent actively extracts and archives the key information from each step. The bulletin is always visible, even at step 200.

**Priority**: P1 (ships as part of H5) | **File**: `tools/record_finding.py`, `system_prompt.md`

---

### C4 · Python Variable Registry

**Gap**: `_persist_model` was created in call #52. At call #98, the agent doesn't know it exists — it tries to re-create it. This is the "Python namespace amnesia" problem.

**Enhancement**: When A3 persists a variable, H5's `PersistentStateMiddleware` registers it in `python_namespace`. Additionally, the system prompt tells the agent to annotate persistent variables with a docstring comment:

```python
# In code:
_persist_model_ridge = RidgeCV(alphas=[0.1, 1.0, 10.0]).fit(X_train, y_train)
# _persist_model_ridge: RidgeCV fitted on (df_train, 890 rows, features: gdp_lag1, unemp, cpi)
```

The middleware reads the comment after `_persist_*` assignments and stores it in the namespace registry.

**Injection format** (in persistent state):
```
Python namespace (persisted across calls):
• _persist_df_clean: cleaned macro DataFrame (1,247 rows, 14 cols, nulls imputed)
• _persist_model_ridge: RidgeCV fitted on train set (R²=0.81, alpha=1.0)
• _persist_scaler: StandardScaler fitted on training features
```

**Priority**: P3 (requires H5 + A3) | **File**: `deep_agent.py`, `sandbox/runner.py`

---

### C5 · Cross-Session Analytical Memory

**Gap**: Every new session starts from zero. The agent re-learns that `gdp_trillions` means GDP in trillions every time. Past successful SQL patterns, user preferences, known dataset quirks — all lost.

**Design**: A lightweight memory layer backed by SQLite (separate table from `agent_state`):

| Memory Type | Key | Content | TTL |
|-------------|-----|---------|-----|
| Dataset quirk | `table_name_hash` | "gdp column is in trillions" | Permanent |
| Successful SQL | `question_keywords` | "SELECT year, gdp_trillions, ... FROM ..." | 30 days |
| User preferences | `user_id` | "prefers bar charts, uses fiscal year (Oct-Sep)" | Permanent |
| Error resolutions | `error_pattern` | "KeyError: revenue → column is total_revenue" | 30 days |

**Injection**: Relevant memories are prepended to the system prompt at conversation start. Relevance = table name match (always) + keyword overlap (heuristic).

**Priority**: P4 (nice-to-have, not load-bearing) | **Difficulty**: High

---

### C6 · Schema Delta Injection (Mid-Session Upload)

**Gap**: If a user uploads a new table mid-conversation, the agent cache is fully invalidated and history is lost.

**Enhancement**: Instead of cache invalidation, inject a schema update message into the active session:

```python
# In api/upload.py, after ingest completes:
async def _inject_schema_into_active_sessions(table_name: str):
    """Update all active sessions without invalidating them."""
    db = get_duckdb()
    schema = db.get_table_schema(table_name)
    cols = "\n".join(f"  - `{c['name']}`: {c['type']}" for c in schema)

    # Update persistent state schema cache for all active sessions
    for session_id in _active_sessions:
        ps = persistent_store.load(session_id)
        ps.schema[table_name] = [f"{c['name']}:{c['type']}" for c in schema]
        persistent_store.save(session_id, ps)
        # The next agent turn will automatically see the updated schema via H5 injection
```

**Priority**: P3 | **Difficulty**: Medium | **File**: `api/upload.py`, `deep_agent.py`

---

## Part 4: Infrastructure

### I1 · Observability Middleware

Track tool call latency, error rates, and token usage. Emit a summary `progress` event at session end:

```python
class MetricsMiddleware(AgentMiddleware):
    def __init__(self):
        self._calls: list[dict] = []

    async def awrap_tool_call(self, request, handler):
        t0 = time.monotonic()
        result = await handler(request)
        elapsed = round(time.monotonic() - t0, 3)
        content = result.content if hasattr(result, "content") else str(result)
        tc = request.tool_call
        self._calls.append({
            "tool": tc.get("name", "") if isinstance(tc, dict) else getattr(tc, "name", ""),
            "elapsed_s": elapsed,
            "chars": len(content),
            "is_error": "Error:" in content,
        })
        return result

    def summary(self) -> dict:
        if not self._calls:
            return {}
        by_tool = {}
        for c in self._calls:
            t = c["tool"]
            by_tool.setdefault(t, {"calls": 0, "total_s": 0, "errors": 0})
            by_tool[t]["calls"] += 1
            by_tool[t]["total_s"] += c["elapsed_s"]
            by_tool[t]["errors"] += int(c["is_error"])
        return {
            "total_calls": len(self._calls),
            "total_elapsed_s": round(sum(c["elapsed_s"] for c in self._calls), 2),
            "error_rate": round(sum(c["is_error"] for c in self._calls) / len(self._calls), 3),
            "by_tool": {t: {**v, "avg_s": round(v["total_s"]/v["calls"], 2)} for t, v in by_tool.items()},
        }
```

Expose at `GET /api/sessions/{id}/metrics`. Store metrics as part of H5 persistent state (no additional DB needed).

**Priority**: P3 | **Difficulty**: Low

---

### I2 · Docker-Based Sandbox (Production Hardening)

AST whitelist catches 95% of threats for an internal tool. Docker catches 100% and adds resource limits:

```python
# config.yaml:
sandbox:
  mode: subprocess  # or "docker"
  docker_image: "analytical-chatbot-sandbox:latest"
  memory_limit: "512m"
  cpu_quota: 0.5  # 50% of one CPU
  network: none
```

The Docker executor is a drop-in replacement for `execute_python()`. Same input/output contract.

**Dependency**: A3 (stateful objects) must be redesigned for Docker — the temp dir needs to be mounted into the container. Plan: mount `/tmp/sandbox_{session_id}/` as a volume.

**Priority**: P4 (production hardening, not needed for development) | **Difficulty**: High

---

### I4 · Skill Hot-Reloading

```python
# In SkillRegistry:
async def watch(self):
    while True:
        await asyncio.sleep(5)
        for path in self._dir.rglob("SKILL.md"):
            h = hashlib.md5(path.read_bytes()).hexdigest()
            if self._hashes.get(str(path)) != h:
                self._reload(path.parent.name)
                self._hashes[str(path)] = h
```

**Priority**: P4 | **Difficulty**: Low

---

## Revised Priority Matrix

### Sprint 1 — Immediate Safety Improvements (no dependencies)

| Enhancement | Impact | File(s) |
|-------------|--------|---------|
| **H1** · EvaluatorMiddleware (expanded error patterns) | High | `deep_agent.py` |
| **A1** · DataFrame Auto-Summary (override print) | High | `sandbox/runner.py` |
| **A5** · Schema-Aware Error Injection (difflib suggestions) | High | `tools/run_python.py` |
| **A6** · Output Size Guard (pre-execution pattern scan) | Medium | `sandbox/executor.py` |
| **A2** · Ruff Pre-Linting (F821 undefined names) | Medium | `sandbox/executor.py` |

### Sprint 2 — Foundation Layer (enables everything else)

| Enhancement | Impact | Depends On | File(s) |
|-------------|--------|-----------|---------|
| **H5** · Persistent Agent State (the load-bearing piece) | Critical | — | `deep_agent.py`, `tools/record_finding.py` |
| **H6** · SQLite Checkpoint Persistence | High | — | `deep_agent.py` |
| **H2** · Plan Validation Against Schema | Medium | — | `deep_agent.py` |

### Sprint 3 — Storage & ACI Depth (builds on Sprint 2)

| Enhancement | Impact | Depends On | File(s) |
|-------------|--------|-----------|---------|
| **C1** · Filesystem Offloading (large result archiving) | High | H5 (session dir) | `deep_agent.py`, `tools/read_result.py` |
| **A3** · Stateful Object Persistence (joblib pkl) | High | H5 (session dir) | `sandbox/runner.py`, `executor.py` |
| **C3** · Key Findings Bulletin | High | H5 (ships together) | `system_prompt.md` |
| **C4** · Variable Registry | Medium | H5 + A3 | `deep_agent.py` |
| **A4** · view_data Paginator Tool | Medium | — | `tools/view_data.py` |
| **A7** · Execution Heartbeat (tool_progress SSE) | Medium | — | `tools/run_python.py` |
| **I1** · Metrics Middleware | Medium | — | `deep_agent.py` |

### Sprint 4 — Intelligence Layer (requires full Sprint 3)

| Enhancement | Impact | Depends On | File(s) |
|-------------|--------|-----------|---------|
| **C2** · Phase-Aware Compaction | High | H5 + C1 | `deep_agent.py` |
| **C6** · Schema Delta Injection | Medium | H5 + H6 | `api/upload.py` |
| **C5** · Cross-Session Memory | Medium | H5 | new `memory/` module |

### Deferred (sub-agent work — after single-agent loop hardened)

| Enhancement | Depends On |
|-------------|-----------|
| H4 · Expanded Sub-Agent Roster | All Sprints 1–4 complete |
| H5-sub · Supervisor Routing with Capability Profiles | H4 |

---

## What NOT to Change

- **`create_deep_agent()` interface** — all enhancements go through middleware and tool additions. Never modify the deepagents SDK call signature.
- **EventBus architecture** — new SSE event types (A7's `tool_progress`) extend it; don't replace it.
- **AST validation** — keep as first-pass gate; A2 (ruff) runs after it, not instead of it.
- **`ToolResultCompactionMiddleware`** — C2 improves the scoring logic but keeps the max_keep safety net.
- **`write_todos` planning** — H5 reads and mirrors the plan into persistent state; it doesn't replace `write_todos`.
- **Skills system** — unchanged. I4 adds hot-reload without touching skill format.

---

## Key Design Principles (Why These Decisions)

**"Message history is RAM, not a database"** — The single most important mental model shift. ToolResultCompactionMiddleware is a RAM eviction policy. H5 is the disk. C1 is the archive. Everything follows from this.

**"Never use the LLM to summarize inside a running session"** — `llm.ainvoke()` inside deepagents' `astream()` leaks tokens. All summarization is rule-based (H1 error hints, C2 phase summaries). The one exception is cross-session memory extraction (C5), which runs in a background task after the session completes.

**"The agent must never need to re-discover what it already knows"** — Schema (H5 schema cache), findings (C3), variable names (C4), resolved errors (H5 error registry) — all of these prevent expensive re-discovery tool calls at step 100+ of a deep session.

**"Fail fast, fail cheap"** — A2 (ruff lint) + A6 (output guard) catch errors before the subprocess burns 5–30 seconds. This is especially important for long tasks where retry cycles compound.

---

*Last updated: 2026-03-25 (full dependency analysis + mental experiment for 150-call sessions)*
