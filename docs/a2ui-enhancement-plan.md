# A2UI Component Enhancement Plan

Tracks planned and implemented A2UI dashboard component additions.
Delete this file once all desired tiers are shipped and stable.

---

## Current State (baseline before enhancements)

Three component types exist today:

| Type | Fields | Notes |
|------|--------|-------|
| `metric` | `title`, `value`, `icon`, `change`, `changeType` (`positive`\|`negative`\|`neutral`), `subtitle` | KPI card with ambient orb |
| `grid` | `columns`, `children[]` | CSS grid wrapper, N columns |
| `text` | `icon`, `content` | Insight/commentary block |

Charts and tables are interleaved as `Artifact` objects (not components), rendered by `DashboardRenderer`.

**Files touched by the dashboard system:**
- `frontend/src/components/workspace/DashboardRenderer.tsx` — all component rendering
- `frontend/src/types/index.ts` — `DashboardComponent` type
- `backend/app/skills/dashboard/SKILL.md` — agent instructions + schemas
- `backend/app/agent/tools/` — `save_artifact.py` (agent-side tool)
- `backend/app/sandbox/runner.py` — `save_dashboard_component()` sandbox shim

---

## Tier 1 — High value, low complexity

### `progress` — Labeled progress bar ✓ SHIPPED
Shows a ratio value (0–100) as a horizontal bar. Useful for utilization, portfolio weight, goal completion.

```json
{
  "type": "progress",
  "title": "Budget Used",
  "value": 74,
  "max": 100,
  "changeType": "negative"
}
```
- `value`: numeric (0–`max`)
- `max`: numeric, default 100
- `changeType`: `"positive"` | `"negative"` | `"neutral"` — colors the bar (green / red / indigo)

**Status:** [x] shipped

---

### `divider` — Section header separator ✓ SHIPPED
Visual break between dashboard sections. Cosmetic only, zero data fields.

```json
{
  "type": "divider",
  "title": "Macro Indicators"
}
```
- `title`: optional label; renders a horizontal rule with centered or left-aligned text

**Status:** [x] shipped

---

### `alert` — Colored callout for thresholds / warnings ✓ SHIPPED
Three severity flavors. Agent uses this when it detects outliers or policy breaches.

```json
{
  "type": "alert",
  "severity": "warning",
  "title": "Inflation above target",
  "content": "CPI at 4.1%, Fed threshold is 2%."
}
```
- `severity`: `"info"` (blue) | `"warning"` (amber) | `"critical"` (red)
- `title`: bold heading line
- `content`: body paragraph

**Status:** [x] shipped

---

## Tier 2 — Medium complexity

### `comparison` — Side-by-side value comparison ✓ SHIPPED
Two values (current vs prior) with a delta label.

```json
{
  "type": "comparison",
  "title": "GDP Growth",
  "current": "3.2%",
  "prior": "2.8%",
  "label": "QoQ",
  "changeType": "positive"
}
```
- `current` / `prior`: display strings
- `label`: period label (e.g., "QoQ", "YoY", "vs Budget")
- `changeType`: colors the delta arrow

**Status:** [x] shipped

---

### `list` — Ranked/bulleted list with optional icons ✓ SHIPPED
For "Top N" summaries, risk factors, key contributors.

```json
{
  "type": "list",
  "title": "Top Contributors",
  "items": [
    { "label": "Technology", "value": "+8.2%", "icon": "devices" },
    { "label": "Healthcare", "value": "+3.1%", "icon": "health_and_safety" }
  ]
}
```
- `items[]`: `{ label, value?, icon? }`
- Renders as a numbered or icon-led vertical list

**Status:** [x] shipped

---

### `sparkline` inside MetricCard — Inline micro-chart ✓ SHIPPED
Embed a tiny Vega-Lite chart (≈50×30px) inside a metric card.
Requires agent to pass a small data array alongside the metric value.

```json
{
  "type": "metric",
  "title": "GDP Growth",
  "value": "3.2%",
  "sparkline": [2.1, 2.4, 1.9, 2.8, 3.2]
}
```
- Higher complexity: frontend must render a mini Vega chart inline
- Agent prompt must explain the `sparkline` array format

**Status:** [x] shipped — field on `metric` type, color matches changeType

---

## Tier 3 — Layout / structural

### Two-column section wrapper ✓ SHIPPED
Layout primitive to place two items side by side (e.g., chart left + text right).
Today everything stacks vertically.

```json
{
  "type": "cols_2",
  "left": { ...component... },
  "right": { ...component... }
}
```

**Status:** [x] shipped

---

### `table` component (inline, compact) ✓ SHIPPED
Small inline table (3–5 rows) as a component, not a full artifact.
Keeps compact summaries inside the dashboard flow.

```json
{
  "type": "table",
  "title": "Summary",
  "columns": ["Quarter", "GDP", "Inflation"],
  "rows": [
    ["Q1 2025", "3.2%", "2.9%"],
    ["Q2 2025", "2.8%", "3.1%"]
  ]
}
```

**Status:** [x] shipped — ≤8 row recommendation, styled with zebra striping

---

## Implementation checklist (per component)

For each new component:
1. Add JSON schema + example to `dashboard/SKILL.md`
2. Add renderer function in `DashboardRenderer.tsx`
3. Add `case` to `ComponentRenderer` switch
4. Update `DashboardComponent` type in `types/index.ts` if new fields needed
5. No backend changes needed — `save_dashboard_component` is schema-agnostic
