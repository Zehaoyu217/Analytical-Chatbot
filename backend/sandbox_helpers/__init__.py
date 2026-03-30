"""sandbox_helpers — built-in helpers available in every run_python sandbox call.

All symbols are auto-imported at sandbox startup. No explicit import needed.

Charting (from sandbox_helpers.charting):
    Constants:  PRIMARY, PRIMARY_DARK, ACCENT_PURPLE, ACCENT_CYAN, ACCENT_AMBER,
                POSITIVE, NEGATIVE, NEUTRAL, TEXT_PRIMARY, TEXT_SECONDARY,
                GRID_COLOR, DOMAIN_COLOR, CAT_PALETTE, SEQ_PALETTE
    Sizing:     W_STANDARD, H_STANDARD, W_WIDE, H_WIDE, W_COMPACT, H_COMPACT, W_SQUARE, H_SQUARE
    Marks:      BAR_CORNER_RADIUS, BAR_OPACITY, LINE_WIDTH, POINT_SIZE, POINT_FILL,
                POINT_STROKE_W, AREA_OPACITY, SCATTER_SIZE, SCATTER_OPACITY,
                DONUT_INNER, DONUT_OUTER, FONT, TITLE_SIZE, LABEL_SIZE, AXIS_TITLE_SIZE
    Functions:  gs_theme(chart, title, width, height)

Tables (from sandbox_helpers.tables):
    Functions:  styled_table_html(df, title) -> str

Diagrams (from sandbox_helpers.diagrams):
    Constants:  GS_MERMAID_THEME

Artifact ops (injected by runner.py — not from this package):
    save_artifact(content, title)                    — create a new artifact
    update_artifact(artifact_id, content, title=None) — update an existing artifact in-place
    save_chart_vegalite, save_table_html, save_mermaid — lower-level saves
    show_component(component_or_list)                — render A2UI component inline
"""
from sandbox_helpers.charting import (
    PRIMARY, PRIMARY_DARK, ACCENT_TEAL, ACCENT_ROSE, ACCENT_AMBER, ACCENT_PURPLE, ACCENT_CYAN,
    POSITIVE, NEGATIVE, NEUTRAL, TEXT_PRIMARY, TEXT_SECONDARY,
    GRID_COLOR, DOMAIN_COLOR, CAT_PALETTE, SEQ_PALETTE,
    W_STANDARD, H_STANDARD, W_WIDE, H_WIDE, W_COMPACT, H_COMPACT, W_SQUARE, H_SQUARE,
    FONT, TITLE_SIZE, LABEL_SIZE, AXIS_TITLE_SIZE,
    BAR_CORNER_RADIUS, BAR_OPACITY, LINE_WIDTH, POINT_SIZE, POINT_FILL,
    POINT_STROKE_W, AREA_OPACITY, SCATTER_SIZE, SCATTER_OPACITY,
    DONUT_INNER, DONUT_OUTER,
    gs_theme,
)
from sandbox_helpers.tables import styled_table_html
from sandbox_helpers.diagrams import GS_MERMAID_THEME

__all__ = [
    # Colors
    "PRIMARY", "PRIMARY_DARK",
    "ACCENT_TEAL", "ACCENT_ROSE", "ACCENT_AMBER", "ACCENT_PURPLE", "ACCENT_CYAN",
    "POSITIVE", "NEGATIVE", "NEUTRAL", "TEXT_PRIMARY", "TEXT_SECONDARY",
    "GRID_COLOR", "DOMAIN_COLOR", "CAT_PALETTE", "SEQ_PALETTE",
    # Sizing
    "W_STANDARD", "H_STANDARD", "W_WIDE", "H_WIDE",
    "W_COMPACT", "H_COMPACT", "W_SQUARE", "H_SQUARE",
    # Typography
    "FONT", "TITLE_SIZE", "LABEL_SIZE", "AXIS_TITLE_SIZE",
    # Marks
    "BAR_CORNER_RADIUS", "BAR_OPACITY", "LINE_WIDTH", "POINT_SIZE", "POINT_FILL",
    "POINT_STROKE_W", "AREA_OPACITY", "SCATTER_SIZE", "SCATTER_OPACITY",
    "DONUT_INNER", "DONUT_OUTER",
    # Functions
    "gs_theme", "styled_table_html", "GS_MERMAID_THEME",
]
