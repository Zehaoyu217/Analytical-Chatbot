```json
{
  "skill_name": "dashboard",
  "skill_description": "Build premium enterprise-level interactive dashboards with A2UI components and GS themes"
}
```

# Premium Enterprise Dashboard Building (A2UI)

Dashboards should look like an enterprise Goldman Sachs trading floor or a Bloomberg terminal: highly polished, data-dense, dark blue/grey themed, using animated metrics and components.

## 1. A2UI Component System
You must push the boundaries of our Agent-to-UI (`save_dashboard_component`) component system. The frontend handles dynamic rendering of these JSON components. 

### Supported A2UI Constructs
You generate the JSON payload; the frontend renders it as glassmorphism UI.

```python
import json

# 1. A2UI Metric Grid (Always start with this)
save_dashboard_component(json.dumps({
    "type": "grid",
    "columns": 3,
    "children": [
        {
            "type": "metric",
            "title": "Total Revenue",
            "value": "$4.2M",
            "icon": "account_balance",  # MUST BE GOOGLE MATERIAL SYMBOL
            "change": "+12%",
            "changeType": "positive"
        },
        {
            "type": "metric",
            "title": "Active Users",
            "value": "12,400",
            "icon": "group",
            "subtitle": "Daily average"
        }
    ]
}), "Key Performance Indicators")

# 2. A2UI Insight Text Block
save_dashboard_component(json.dumps({
    "type": "text",
    "icon": "lightbulb",
    "content": "Key insights: The system successfully processed $4.2M in volume, primarily driven by the enterprise segment."
}), "Executive Summary")
```

## 2. Incorporating Altair and Tables
After laying down the A2UI KPI grid and text block, you should embed premium charts (using `gs_theme()`) and heavily styled HTML tables (Zebra striping, blue/grey/white borders). 

A good enterprise dashboard order:
1. `save_dashboard_component` (A2UI KPI Grid)
2. `save_chart_vegalite` (Primary GS-Themed Altair Chart)
3. `save_dashboard_component` (A2UI Insight Text)
4. `save_artifact` (Detailed HTML Table in GS-Theme)

## 3. Mandatory Safety Fallback
**A2UI is very new and can occasionally cause rendering issues on the frontend if the JSON schema is violated or if an unsupported constraint is generated.**

- **Rule:** Be extremely careful to match the JSON structures exactly as shown above.
- **Rule:** Use `json.dumps()` in Python to guarantee validity.
- **Fallback Protocol:** If the dashboard components fail to render or produce pipeline errors, **immediately revert** to generating standard Markdown and basic Altair charts outside of `save_dashboard_component`. 

Go build beautiful, Goldman Sachs-inspired dashboards!
