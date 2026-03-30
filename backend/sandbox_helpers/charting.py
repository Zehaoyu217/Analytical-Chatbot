"""OneGS charting constants and theme helper.

Auto-imported into every run_python sandbox call.
Use these directly — no imports needed in your code.
"""
from __future__ import annotations

# ── Colors ── financial data-viz palette (not AI slop) ───────────────
PRIMARY        = '#3d7be8'   # Sapphire blue — primary series / lines
PRIMARY_DARK   = '#2860c4'   # Darker sapphire — emphasis, active states
ACCENT_TEAL    = '#2eb89a'   # Teal — second series
ACCENT_AMBER   = '#e8a820'   # Amber — third series, annotations, callouts
ACCENT_ROSE    = '#e05c7c'   # Rose — fourth series
POSITIVE       = '#22c55e'   # Green — gains, above-benchmark
NEGATIVE       = '#f43f5e'   # Red — losses, below-benchmark
NEUTRAL        = '#5c6278'   # Muted steel — baselines, reference lines
TEXT_PRIMARY   = '#e8ecf4'   # Chart title — matches --text-primary
TEXT_SECONDARY = '#8494ad'   # Axis labels, legend — matches --text-secondary
GRID_COLOR     = 'rgba(255,255,255,0.04)'
DOMAIN_COLOR   = 'rgba(255,255,255,0.10)'

# Categorical palette — 6 distinct, readable on dark background
CAT_PALETTE = ['#3d7be8', '#2eb89a', '#e8a820', '#e05c7c', '#9b7fe8', '#5fb8d4']

# Sequential palette — sapphire spectrum
SEQ_PALETTE = ['#bfd4f8', '#7aadf0', '#3d7be8', '#2860c4', '#1a3e7c']

# Keep old names as aliases for backwards-compat with existing agent code
ACCENT_PURPLE = '#9b7fe8'   # Was violet-400; now a muted indigo alias
ACCENT_CYAN   = '#5fb8d4'   # Was cyan-400; now a sky alias

# ── Sizing (fixed — never auto-stretch) ─────────────────────────────
W_STANDARD, H_STANDARD = 640, 400   # 16:10 — default
W_WIDE,     H_WIDE     = 720, 405   # 16:9  — dashboards, time series
W_COMPACT,  H_COMPACT  = 480, 360   # 4:3   — small panels
W_SQUARE,   H_SQUARE   = 400, 400   # 1:1   — donut, radial

# ── Typography ───────────────────────────────────────────────────────
FONT            = "'IBM Plex Sans', Inter, system-ui, sans-serif"
FONT_MONO       = "'IBM Plex Mono', 'JetBrains Mono', monospace"
TITLE_SIZE      = 17   # larger than body text (14px)
LABEL_SIZE      = 13   # tick values — one smaller than body
AXIS_TITLE_SIZE = 14   # X/Y axis titles — matches conversation body (14px)

# ── Mark styles ──────────────────────────────────────────────────────
BAR_CORNER_RADIUS = 3       # Tight — GS terminal feel, not rounded consumer card
BAR_OPACITY       = 0.92
LINE_WIDTH        = 2
POINT_SIZE        = 45
POINT_FILL        = '#f1f3f9'
POINT_STROKE_W    = 2
AREA_OPACITY      = 0.10    # Slightly more visible than 0.06
SCATTER_SIZE      = 55
SCATTER_OPACITY   = 0.75
DONUT_INNER, DONUT_OUTER = 80, 150


def gs_theme(chart, title: str = "", width: int | None = None, height: int | None = None):
    """Apply the OneGS dark financial theme to any Altair chart.

    Args:
        chart:  Altair chart object (before .configure_*)
        title:  Chart title string
        width:  Pixel width — defaults to W_STANDARD (640)
        height: Pixel height — defaults to H_STANDARD (400)

    Returns:
        Configured Altair chart ready for save_artifact() or save_chart_vegalite()

    Example:
        chart = gs_theme(area + line + points, "GDP Growth Rate")
        save_artifact(chart, "GDP Growth Rate")
    """
    import altair as alt
    w = width if width is not None else W_STANDARD
    h = height if height is not None else H_STANDARD
    return (
        chart
        .properties(
            title=alt.Title(
                title,
                fontSize=TITLE_SIZE,
                fontWeight=700,
                color=TEXT_PRIMARY,
                font=FONT,
                anchor='start',
                offset=12,
            ),
            width=w,
            height=h,
        )
        .configure(background='transparent', font=FONT)
        .configure_axis(
            labelColor=TEXT_SECONDARY, titleColor=TEXT_SECONDARY,
            gridColor=GRID_COLOR, domainColor=DOMAIN_COLOR,
            labelFontSize=LABEL_SIZE, titleFontSize=AXIS_TITLE_SIZE,
            tickColor=DOMAIN_COLOR, labelFont=FONT, titleFont=FONT,
            labelPadding=6,
        )
        .configure_legend(
            labelColor=TEXT_SECONDARY, titleColor=TEXT_PRIMARY,
            labelFontSize=LABEL_SIZE, titleFontSize=AXIS_TITLE_SIZE,
            labelFont=FONT, titleFont=FONT,
            orient='bottom', padding=12, columnPadding=16,
        )
        .configure_view(strokeWidth=0)
        .configure_mark(font=FONT)
    )
