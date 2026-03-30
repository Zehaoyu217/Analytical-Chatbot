# Extending the System

## Add a New Skill

The most common extension. No code changes needed.

1. Create `backend/app/skills/my_skill.md`:
```markdown
---
name: my_skill
description: One-line description
triggers: [keyword1, keyword2]
tools_required: [query_duckdb, run_python]
---
## Procedure
1. Table names and schemas are in your context
2. Do X using query_duckdb or run_python
3. Save results as artifacts
## Examples
- "user question" --> expected approach
```

2. Add keywords to `backend/app/agent/nodes/router.py`:
```python
SKILL_KEYWORDS["my_skill"] = ["keyword1", "keyword2", "keyword3"]
```

3. Test: upload data, ask a matching question, check progress panel shows "Skill: my_skill"

**Tips:**
- Skills are auto-discovered from `backend/app/skills/*.md`
- Keep instructions concise (injected into system prompt = token cost)
- Include concrete code examples the LLM can follow
- Say "schemas are already in your context" to prevent redundant tool calls

## Add a New Agent Tool

1. Create `backend/app/agent/tools/my_tool.py`:
```python
from langchain_core.tools import tool

@tool
def my_tool(param: str) -> str:
    """Description the LLM sees when deciding to call this tool."""
    # implementation
    return "result"
```

2. Register in `backend/app/agent/nodes/executor.py`:
```python
from app.agent.tools.my_tool import my_tool
TOOLS = [..., my_tool]
```

3. Document in `backend/app/agent/prompts/system_prompt.md`

## Add a New API Endpoint

1. Create `backend/app/api/my_endpoint.py` with `router = APIRouter()`
2. Register in `backend/app/api/router.py`: `api_router.include_router(my_endpoint.router)`

## Add a New LLM Provider

1. Add branch in `backend/app/llm/provider.py` `create_chat_model()`
2. Install: `pip install langchain-<provider>`
3. Add API key to config/env

## Add a New Frontend Component

1. Create in `frontend/src/components/`
2. For new SSE events: update `lib/sse.ts` + `types/index.ts`
3. For new state: update Zustand store in `stores/`
