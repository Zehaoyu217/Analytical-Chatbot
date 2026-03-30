```json
{
  "skill_name": "altair_charts",
  "skill_description": "Professional Altair chart templates with financial-industry chart selection logic, fixed aspect ratios, and OneGS styling"
}
```

# Professional Altair Charts (OneGS Theme)

**CRITICAL: NEVER USE `.interactive()`. It is dangerous and disabled.**

## Config Parameters

Copy these constants into every `run_python` chart code block:

```python
# ── OneGS Chart Config ──────────────────────────────────────────
# Colors
PRIMARY       = '#3b82f6'    # Corporate blue — bars, primary lines
PRIMARY_DARK  = '#0055b8'    # Emphasis, headlines
ACCENT_PURPLE = '#8b5cf6'    # Second series
ACCENT_CYAN   = '#06b6d4'    # Third series
ACCENT_AMBER  = '#f59e0b'    # Fourth series / warnings
POSITIVE      = '#22c55e'    # Gains, above-benchmark
NEGATIVE      = '#ef4444'    # Losses, below-benchmark
NEUTRAL       = '#64748b'    # Baselines, reference lines
TEXT_PRIMARY   = '#e8ecf1'   # Chart title
TEXT_SECONDARY = '#9da3b4'   # Axis labels, legend text
GRID_COLOR     = 'rgba(255,255,255,0.05)'
DOMAIN_COLOR   = 'rgba(255,255,255,0.1)'

# Categorical palette (max 6 series)
CAT_PALETTE = [PRIMARY, ACCENT_PURPLE, ACCENT_CYAN, ACCENT_AMBER, NEGATIVE, POSITIVE]
# Sequential palette (heatmaps, gradients)
SEQ_PALETTE = ['#dbeafe', '#93c5fd', '#3b82f6', '#1d4ed8', '#1e3a5f']

# Sizing (fixed — never auto-stretch)
W_STANDARD, H_STANDARD = 640, 400    # 16:10 — default
W_WIDE,     H_WIDE     = 720, 405    # 16:9  — dashboards, time series
W_COMPACT,  H_COMPACT  = 480, 360    # 4:3   — small panels
W_SQUARE,   H_SQUARE   = 400, 400    # 1:1   — donut, radial

# Typography
FONT = 'Inter, sans-serif'
TITLE_SIZE, LABEL_SIZE, AXIS_TITLE_SIZE = 15, 11, 12

# Marks
BAR_CORNER_RADIUS = 5
BAR_OPACITY       = 0.9
LINE_WIDTH        = 2
POINT_SIZE        = 40
POINT_FILL        = 'white'
POINT_STROKE_W    = 2
AREA_OPACITY      = 0.06
SCATTER_SIZE       = 60
SCATTER_OPACITY    = 0.7
DONUT_INNER, DONUT_OUTER = 80, 150
```

## 1. Chart Type Selection

Choose the right chart for the data. This is non-negotiable.

| Data Pattern | Chart Type | Notes |
|---|---|---|
| Single time series (GDP, rates over time) | **Connected-dot line** | Line + point overlay, area fill underneath |
| Multiple time series (comparing metrics) | **Multi-line** | Color-encoded, shared axis, legend at bottom |
| Category comparison (GDP by country) | **Vertical bar** | Sorted desc by value, rounded corners |
| Ranked list / long labels | **Horizontal bar** | Labels read naturally left-to-right |
| Part-of-whole composition | **Donut** | Inner radius ≥ 0.55 × outer. **NEVER pie chart** |
| Grouped comparison (Q1 vs Q2 by region) | **Grouped bar** | `xOffset` encoding, max 4–5 groups |
| Correlation / relationship | **Scatter** | Opacity for density, regression line optional |
| Distribution | **Histogram / KDE** | `mark_bar` with bin, or `mark_area` with density transform |
| Change decomposition | **Waterfall** | Show how contributions sum to total |

### Rules
- **NEVER use pie charts.** Use donut instead.
- Time series data → ALWAYS line chart (not bar).
- ≤ 7 categories → bar. > 7 → horizontal bar.
- When user says "chart" with no type specified → infer from data shape.

## 2. Aspect Ratio & Sizing

Use fixed dimensions — never let charts auto-stretch to fill the container. The ratio must be constant.

| Chart Type | Width × Height | Ratio |
|---|---|---|
| Standard (bar, line, scatter) | `640 × 400` | 16:10 |
| Wide time series / dashboards | `720 × 405` | 16:9 |
| Compact / side panel | `480 × 360` | 4:3 |
| Donut / radial | `400 × 400` | 1:1 |

Pass these as `.properties(width=640, height=400)` — Altair will respect them as fixed pixel dimensions.

## 3. The GS Theme Helper

Apply to ALL charts before saving. This purges the skeletal Altair defaults. Uses config constants from above.

```python
def gs_theme(base_chart, title="", width=W_STANDARD, height=H_STANDARD):
    """Professional OneGS blue/grey theme with fixed dimensions."""
    return base_chart.properties(
        title=alt.Title(title, fontSize=TITLE_SIZE, fontWeight=600, color=TEXT_PRIMARY, anchor='start', offset=10),
        width=width, height=height
    ).configure(
        background='transparent',
        font=FONT
    ).configure_axis(
        labelColor=TEXT_SECONDARY, titleColor=TEXT_SECONDARY,
        gridColor=GRID_COLOR, domainColor=DOMAIN_COLOR,
        labelFontSize=LABEL_SIZE, titleFontSize=AXIS_TITLE_SIZE, tickColor=DOMAIN_COLOR
    ).configure_legend(
        labelColor=TEXT_SECONDARY, titleColor=TEXT_PRIMARY,
        labelFontSize=LABEL_SIZE, titleFontSize=AXIS_TITLE_SIZE, orient='bottom', padding=12
    ).configure_view(strokeWidth=0)
```

## 4. Templates

All templates assume the Config Parameters block and `gs_theme()` are defined above the chart code. Use `import altair as alt` at the top.

### A. Connected-Dot Line Chart (Time Series — DEFAULT)

The signature financial chart: line + white-filled points + subtle area fill.

```python
import altair as alt
df = _db.execute("SELECT quarter as date, gdp_growth_pct as value FROM table ORDER BY date").df()

base = alt.Chart(df).encode(
    x=alt.X('date:T', axis=alt.Axis(grid=False, title=None, format='%Y')),
    y=alt.Y('value:Q', axis=alt.Axis(title='GDP Growth (%)')),
    tooltip=[alt.Tooltip('date:T', title='Date', format='%b %Y'),
             alt.Tooltip('value:Q', title='Value', format=',.2f')]
)

area = base.mark_area(color=PRIMARY, opacity=AREA_OPACITY, interpolate='monotone')
line = base.mark_line(color=PRIMARY, strokeWidth=LINE_WIDTH, interpolate='monotone')
points = base.mark_point(filled=True, fill=POINT_FILL, stroke=PRIMARY, strokeWidth=POINT_STROKE_W, size=POINT_SIZE)

chart = gs_theme(area + line + points, "GDP Growth Rate")
save_chart_vegalite(chart, "GDP Growth Rate")
```

### B. Multi-Series Line

```python
base = alt.Chart(df).encode(
    x=alt.X('date:T', axis=alt.Axis(grid=False, title=None)),
    y=alt.Y('value:Q', axis=alt.Axis(title='Rate (%)')),
    color=alt.Color('series:N', scale=alt.Scale(range=CAT_PALETTE[:3]),
                    legend=alt.Legend(title=None)),
    tooltip=['date:T', alt.Tooltip('value:Q', format=',.2f'), 'series:N']
)
line = base.mark_line(strokeWidth=LINE_WIDTH, interpolate='monotone')
points = base.mark_point(filled=True, fill=POINT_FILL, strokeWidth=POINT_STROKE_W, size=POINT_SIZE)

chart = gs_theme(line + points, "Rate Comparison")
save_chart_vegalite(chart, "Rate Comparison")
```

### C. Vertical Bar (Category Comparison)

```python
chart = alt.Chart(df).mark_bar(
    cornerRadiusTopLeft=BAR_CORNER_RADIUS, cornerRadiusTopRight=BAR_CORNER_RADIUS,
    color=PRIMARY, opacity=BAR_OPACITY
).encode(
    x=alt.X('category:N', sort='-y', axis=alt.Axis(labelAngle=-30, title=None)),
    y=alt.Y('value:Q', axis=alt.Axis(title='Amount ($B)')),
    tooltip=['category:N', alt.Tooltip('value:Q', format='$,.1f')]
)
chart = gs_theme(chart, "Revenue by Segment")
save_chart_vegalite(chart, "Revenue by Segment")
```

### D. Horizontal Bar (Ranked / Long Labels)

```python
chart = alt.Chart(df).mark_bar(
    cornerRadiusBottomRight=BAR_CORNER_RADIUS, cornerRadiusTopRight=BAR_CORNER_RADIUS,
    color=PRIMARY, opacity=BAR_OPACITY
).encode(
    y=alt.Y('category:N', sort='-x', axis=alt.Axis(title=None)),
    x=alt.X('value:Q', axis=alt.Axis(title='Score')),
    tooltip=['category:N', alt.Tooltip('value:Q', format=',.1f')]
)
chart = gs_theme(chart, "Ranked Metrics")
save_chart_vegalite(chart, "Ranked Metrics")
```

### E. Grouped Bar (Period Comparison)

```python
chart = alt.Chart(df).mark_bar(
    cornerRadiusTopLeft=4, cornerRadiusTopRight=4
).encode(
    x=alt.X('category:N', axis=alt.Axis(title=None, labelAngle=0)),
    y=alt.Y('value:Q', axis=alt.Axis(title='Value')),
    color=alt.Color('period:N', scale=alt.Scale(range=[PRIMARY, '#93c5fd']),
                    legend=alt.Legend(title=None)),
    xOffset='period:N',
    tooltip=['category:N', 'period:N', alt.Tooltip('value:Q', format=',.1f')]
)
chart = gs_theme(chart, "Q1 vs Q2 Performance")
save_chart_vegalite(chart, "Quarterly Comparison")
```

### F. Donut (Composition)

```python
chart = alt.Chart(df).mark_arc(innerRadius=DONUT_INNER, outerRadius=DONUT_OUTER, padAngle=0.02).encode(
    theta=alt.Theta('value:Q'),
    color=alt.Color('category:N', scale=alt.Scale(range=CAT_PALETTE[:5]),
                    legend=alt.Legend(title=None)),
    tooltip=['category:N', alt.Tooltip('value:Q', format=',.1f')]
)
chart = gs_theme(chart, "Portfolio Allocation", width=W_SQUARE, height=H_SQUARE)
save_chart_vegalite(chart, "Portfolio Allocation")
```

### G. Scatter (Correlation)

```python
chart = alt.Chart(df).mark_circle(size=SCATTER_SIZE, opacity=SCATTER_OPACITY).encode(
    x=alt.X('var_x:Q', scale=alt.Scale(zero=False), axis=alt.Axis(title='Risk')),
    y=alt.Y('var_y:Q', scale=alt.Scale(zero=False), axis=alt.Axis(title='Return')),
    color=alt.Color('group:N', scale=alt.Scale(range=CAT_PALETTE[:3])),
    tooltip=['var_x:Q', 'var_y:Q', 'group:N']
)
chart = gs_theme(chart, "Risk vs Return")
save_chart_vegalite(chart, "Risk Return Analysis")
```

## 5. Financial Variable Conventions

Standard chart choices used by Bloomberg, Goldman, JPMorgan for macro data:

| Variable | Preferred Chart | Axis Format | Notes |
|---|---|---|---|
| GDP growth | Connected-dot line | `,.1f` + `%` suffix | Show recession bars as grey bands if available |
| Interest rates | Multi-line | `,.2f` + `%` | Compare Fed Funds, 10Y, 2Y on same axis |
| Inflation (CPI) | Connected-dot line | `,.1f%` | Add 2% target as horizontal rule |
| Unemployment | Area + line | `,.1f%` | Area fill emphasizes magnitude |
| Stock returns | Bar chart (monthly) | `+,.1f%` | Green/red conditional color using `POSITIVE`/`NEGATIVE` |
| Sector allocation | Donut | `,.0f%` | Max 6–8 slices, use `CAT_PALETTE` |
| Yield curve | Line (no points) | `,.2f%` | X = maturity, not dates |
| Correlation matrix | Heatmap | `,.2f` | Use `SEQ_PALETTE` |

## 6. Strict Rules

1. **NEVER use `.interactive()`** — tooltips are sufficient.
2. **ALWAYS include tooltips** with formatted values.
3. **ALWAYS use `gs_theme()`** — no raw Altair defaults.
4. **ALWAYS end with `save_chart_vegalite(chart, "Title")`** — without it, nothing appears.
5. **Fixed dimensions** — `gs_theme` defaults to `W_STANDARD × H_STANDARD`. Use `W_SQUARE/H_SQUARE` for donuts.
6. **NEVER pie charts** — use donut with `innerRadius=DONUT_INNER`.
7. **Max 6 colors** — use `CAT_PALETTE[:N]`. Beyond 6 series, aggregate or filter.
8. **Label angles**: 0° for ≤ 5 labels, -30° for 6–10, -45° for 10+.
9. **Config first** — always paste the Config Parameters block at the top of your code.

