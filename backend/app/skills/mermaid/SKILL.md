```json
{
  "skill_name": "mermaid",
  "skill_description": "Create fancy, spacious, and professional Mermaid diagrams using the GS color palette"
}
```

# Professional Mermaid Diagrams

Mermaid diagrams should look like enterprise architecture documents, not sad, skeletal whiteboards. You must actively inject configuration blocks to style them with the GS Blue/Grey/White theme.

## 1. The Theme Configuration (REQUIRED)
You must ALWAYS prepend this `%%{init: ...}%%` block to your Mermaid string to override the default ugliness with our dark corporate blue flavor.

```mermaid
%%{init: {
  'theme': 'base',
  'themeVariables': {
    'primaryColor': '#1e293b',
    'primaryTextColor': '#f8fafc',
    'primaryBorderColor': '#3b82f6',
    'lineColor': '#94a3b8',
    'secondaryColor': '#0055b8',
    'tertiaryColor': '#0f172a',
    'fontFamily': 'Google Sans, sans-serif'
  }
}}%%
graph TD
  ...
```

## 2. Advanced Styling Rules
- Use structural layers (Graph TD or LR).
- Utilize FontAwesome/Material-like textual icons inside nodes if plausible (e.g. `A[fa:fa-database Database]`).
- Use varying shapes for varying semantic meanings:
  - `[]` for standard processes/nodes.
  - `()` for start/end points or rounded data stores.
  - `{}` for decisions.
  - `[()]` for databases.
- Thicken specific critical paths using `style`.

## 3. Example Template

```python
import inspect

diagram = inspect.cleandoc("""
%%{init: {
  'theme': 'base',
  'themeVariables': {
    'primaryColor': '#1e293b',
    'primaryTextColor': '#f8fafc',
    'primaryBorderColor': '#3b82f6',
    'lineColor': '#94a3b8',
    'secondaryColor': '#0055b8',
    'tertiaryColor': '#0f172a',
    'fontFamily': 'Google Sans, sans-serif'
  }
}}%%
graph TD
    User([fa:fa-user User]) -->|Uploads File| API[fa:fa-server FastAPI]
    API --> Db[(fa:fa-database DuckDB)]
    
    subgraph Data Processing
        Db -->|Query| Agent{fa:fa-robot AI Analyst}
        Agent -->|Run Python| Sandbox[fa:fa-shield Secure Sandbox]
        Sandbox -->|Results| Agent
    end
    
    Agent -->|Stream A2UI| UI[fa:fa-desktop Dashboard UI]
    
    style User fill:#0055b8,stroke:#60a5fa,stroke-width:2px,color:#fff
    style Agent fill:#3b82f6,stroke:#93c5fd,stroke-width:2px,color:#fff
""")

save_artifact("System Architecture", diagram, "diagram", "mermaid")
```

**MANDATORY:** Always provide thick strokes (`stroke-width:2px`), spacious layouts (`TD` or `LR`), and high-contrast readable text. Do not generate unstyled raw Mermaid.
