```json
{
  "skill_name": "tables",
  "skill_description": "Create beautiful, enterprise-grade Markdown and HTML tables with Google Material icons"
}
```

# Premium Tables Skill

Data must be presented cleanly and professionally. Avoid plain, dense tables.

## 1. Markdown Tables (Default)
When returning simple data in chat, use well-spaced markdown tables. 
- You MUST insert relevant Google Material Icons next to column headers to give it a premium feel (e.g. `<span class="material-symbols-rounded">tag</span> ID`).
- Keep text concise.

Example:
| <span class="material-symbols-rounded py-1 pr-1 text-[#0055b8]">calendar_month</span> Date | <span class="material-symbols-rounded py-1 pr-1 text-[#0055b8]">account_balance</span> Revenue | <span class="material-symbols-rounded py-1 pr-1 text-[#0055b8]">trending_up</span> Growth |
| :--- | :--- | :--- |
| 2026-Q1 | $4.2M | +12% |

## 2. Advanced HTML Tables (Python `run_python`)
For complex data, use `run_python` to generate a heavily styled HTML string and save it using `save_artifact()`. Apply the OneGS blue/grey theme.

```python
import pandas as pd
df = _db.execute("SELECT * FROM my_table LIMIT 5").df()

# Build enterprise HTML table with basic tailwind-like inline styles matching the GS theme
html = f"""
<div style="font-family: 'Google Sans', sans-serif; border: 1px solid #2d3748; border-radius: 8px; overflow: hidden; background: #1a202c;">
    <table style="width: 100%; border-collapse: collapse; text-align: left; color: #e2e8f0; font-size: 14px;">
        <thead style="background-color: #0055b8; color: #ffffff;">
            <tr>
"""
for col in df.columns:
    html += f'<th style="padding: 12px 16px; border-bottom: 2px solid #2b6cb0font-weight: 500;">{col}</th>'
html += "</tr></thead><tbody>"

for i, row in df.iterrows():
    bg = "#1a202c" if i % 2 == 0 else "#2d3748" # Subtle Zebra striping
    html += f'<tr style="background-color: {bg}; border-bottom: 1px solid #4a5568;">'
    for val in row:
        html += f'<td style="padding: 12px 16px;">{val}</td>'
    html += "</tr>"

html += "</tbody></table></div>"

save_artifact("Premium Summary Table", html, "table", "html")
```

**Key Takeaways:**
1. No sad/skeleton tables. Always use padding and logical alignment.
2. Zebra striping is highly encouraged for readability.
3. Incorporate Material Icons where appropriate.
