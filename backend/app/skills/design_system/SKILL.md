```json
{
  "skill_name": "design_system",
  "skill_description": "Centralized design system for themes, colors, and aesthetics across all output types"
}
```

# Design System Preference (OneGS Theme)

This skill coordinates the aesthetic look and feel of the chatbot's outputs, ensuring consistency and a premium enterprise experience modeled after Goldman Sachs (OneGS).

## Theme & Colors
- **Primary Color:** Corporate Blue (`#0055b8` or `#3b82f6`). Use for prominent actions, chart primary marks, and diagram main nodes.
- **Secondary Colors:** Crisp White (`#ffffff`), Light Grey (`#f2f4f6`), and neutral Charcoal (`#1a1d20`) for text/borders.
- **Dark Mode Aesthetic:** The frontend uses a breathable dark UI (`#0d0f14` base). Ensure any custom HTML blends well (e.g., transparent backgrounds, light grey borders, avoid glaring white blocks unless styled).

## Icons
- **Google Material Symbols ONLY.** Do NOT use simple emojis. 
- Use names like `analytics`, `table_chart`, `schema`, `account_balance`, `query_stats`, `dashboard`, `bar_chart`, `timeline`.
- If rendering in HTML, you can use: `<span class="material-symbols-rounded text-blue-500">analytics</span>`.

## Aesthetic Directives
- See `load_skill("tables")` for table formatting.
- See `load_skill("altair_charts")` for Altair charts.
- See `load_skill("mermaid")` for diagrams.
- See `load_skill("dashboard")` for enterprise dashboards.
