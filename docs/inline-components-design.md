# Inline A2UI Components in Chat — Design & Implementation Record

Tracks every file touched by the "inline_component" feature so changes can be
partially or fully reverted. Delete this file once the feature is stable and
you no longer need the rollback reference.

---

## What this feature does

Adds a new output channel: the agent can now render A2UI components (metric
cards, alerts, comparisons, lists, progress bars, etc.) directly inside chat
message bubbles — not just in the Workspace tab.

```
Before:  chat bubble = text + inline artifacts (charts / tables / diagrams)
After:   chat bubble = text + inline artifacts + inline component groups
```

The Workspace dashboard path is unchanged. The two paths are independent:

| What agent calls | Where it appears |
|---|---|
| `save_dashboard_component(...)` | Workspace tab only |
| `show_component(...)` | Chat bubble only |
| `save_artifact(...)` | Chat bubble + Artifacts panel |

---

## New SSE event

**Event name:** `inline_component`

**Payload:**
```json
{
  "components": [ { "type": "metric", "title": "...", ... }, ... ],
  "title": "optional group title"
}
```

Emitted by the `show_component` agent tool and by `run_python` when sandbox
code calls `show_component()`.

---

## Every file changed, with exact locations and what to undo

---

### BACKEND

---

#### `backend/app/agent/tools/show_component.py` — NEW FILE

**What it does:** LangChain `@tool` that the agent calls directly (not inside
`run_python`). Parses the `components` JSON string, emits `inline_component`
SSE event via EventBus, returns a confirmation string.

**To revert:** Delete the file. Then undo Steps 5 and 6 below.

---

#### `backend/app/sandbox/executor.py`

**Location:** `SandboxResult.__init__` (lines ~17–35), `to_dict` (lines ~37–47)

**What changed:**
- Added `inline_components: list[dict] | None = None` parameter to `__init__`
- Added `self.inline_components = inline_components or []` in body
- Added `"inline_components": self.inline_components` to `to_dict()` return dict

**To revert:** Remove those three additions. The `SandboxResult` constructor and
dict serializer return to their original 7-field form.

---

#### `backend/app/sandbox/runner.py`

**Location:** `RUNNER_TEMPLATE` string, two places:

1. **Line ~20** — `_result` dict literal:
   Added `"inline_components": []` key.
   To revert: remove that key from the dict.

2. **After `save_artifact` function, before the `try:` block** — new function:
   Added `show_component(component_or_list, title="")` helper that appends
   to `_result["inline_components"]`.
   To revert: delete the entire `show_component` function definition.

---

#### `backend/app/agent/tools/run_python.py`

**Location:** After the `for diagram_data in result.diagrams:` block.

**What changed:** Added a new loop:
```python
for group_data in result.inline_components:
    # emits inline_component SSE event via EventBus
```
Also added imports at top: `asyncio`, `AgentEvent` from `app.events.bus`,
`current_event_bus` from `app.agent.context`.

**To revert:** Remove the `for group_data` loop and the three new imports.

---

#### `backend/app/agent/tools/__init__.py`

**What changed:** Added `from app.agent.tools.show_component import show_component`.

**To revert:** Remove that import line.

---

#### `backend/app/agent/deep_agent.py`

**Location:** Line ~30 (imports) and line ~45 (`AGENT_TOOLS` list).

**What changed:**
- Added `from app.agent.tools.show_component import show_component` to imports
- Added `show_component` to `AGENT_TOOLS` list

**To revert:** Remove import and remove `show_component` from the list.

---

#### `backend/app/agent/prompts/system_prompt.md`

**What changed:**
- Added `show_component(components, title)` entry to the Tools section
- Added a new "Inline Components" rule section explaining when to use it
  vs `save_dashboard_component`

**To revert:** Delete those two additions from the markdown.

---

#### `backend/app/skills/dashboard/SKILL.md`

**What changed:** Added a new "## Inline Chat Components" section at the end
with `show_component()` usage examples (quick answer pattern + multi-component
group pattern) and rules.

**To revert:** Delete from `## Inline Chat Components` to end of file.

---

### FRONTEND

---

#### `frontend/src/types/index.ts`

**What changed:**
1. New interface added:
   ```typescript
   export interface InlineComponentGroup {
     id: string;
     title?: string;
     components: DashboardComponent[];
   }
   ```
2. `Message` interface extended with:
   ```typescript
   inlineComponentGroups?: InlineComponentGroup[];
   ```

**To revert:** Delete the `InlineComponentGroup` interface. Remove
`inlineComponentGroups` from `Message`.

---

#### `frontend/src/lib/sse.ts`

**What changed:**
1. Added to `SSECallbacks`:
   ```typescript
   onInlineComponent?: (event: { components: DashboardComponent[]; title?: string }) => void;
   ```
2. Added case to the switch statement:
   ```typescript
   case "inline_component":
     callbacks.onInlineComponent?.(data as {...});
     break;
   ```

**To revert:** Remove the `onInlineComponent` property from `SSECallbacks`.
Remove the `"inline_component"` case from the switch.

---

#### `frontend/src/stores/chatStore.ts`

**What changed:**
1. Added `InlineComponentGroup` to imports
2. Added `addInlineComponents` to `ChatState` interface:
   ```typescript
   addInlineComponents: (group: Omit<InlineComponentGroup, "id">) => void;
   ```
3. Added implementation of `addInlineComponents` — attaches the group to the
   current streaming assistant message (mirrors `addArtifact` pattern exactly,
   using `findLastIndex` for the streaming message).

**To revert:** Remove import, remove from interface, remove implementation block.
The `clearMessages` action needs no change (it resets `messages: []` which
already clears `inlineComponentGroups` since they live on message objects).

---

#### `frontend/src/hooks/useChat.ts`

**What changed:** Added `onInlineComponent` wiring in the `streamChat` callbacks
object:
```typescript
onInlineComponent: (event) => {
  useChatStore.getState().addInlineComponents({
    title: event.title,
    components: event.components,
  });
},
```

**To revert:** Remove the `onInlineComponent` entry from the callbacks object.

---

#### `frontend/src/components/workspace/DashboardRenderer.tsx`

**What changed:** Added `export` keyword to `ComponentRenderer`:
```typescript
// Before:
function ComponentRenderer(...)
// After:
export function ComponentRenderer(...)
```

**To revert:** Remove the `export` keyword. Note: this will also break the
`MessageBubble` import below, so revert both together.

**Why this is safe:** `ComponentRenderer` is not imported anywhere else
currently. Adding `export` is non-breaking.

---

#### `frontend/src/components/chat/MessageBubble.tsx`

**What changed:**
1. Added imports:
   ```typescript
   import { ComponentRenderer } from "@/components/workspace/DashboardRenderer";
   import type { InlineComponentGroup } from "@/types";
   ```
2. Added inside `MessageBubble` function body:
   ```typescript
   const inlineComponentGroups = message.inlineComponentGroups || [];
   ```
3. Added JSX block after `{inlineArtifacts.map(...)}`:
   ```tsx
   {inlineComponentGroups.map((group) => (
     <InlineComponentBlock key={group.id} group={group} />
   ))}
   ```
4. Added new component function `InlineComponentBlock` that renders a titled
   group of `ComponentRenderer` instances.

**To revert:** Remove the two imports, remove the `inlineComponentGroups`
variable, remove the JSX block, delete `InlineComponentBlock`.

---

### TESTS

---

#### `frontend/src/__tests__/sse.test.ts`

**What changed:** Added `onInlineComponent: vi.fn()` to the `createCallbacks()`
helper function.

**To revert:** Remove that line.

---

#### `frontend/src/__tests__/chatStore.test.ts`

**What changed:** Added a test case for `addInlineComponents` verifying that
the group is attached to the current streaming message.

**To revert:** Delete the new test block.

---

## Rollback recipes

### Full rollback (remove entire feature)
Delete `show_component.py`, then revert all files listed above in reverse order
(tests → frontend → backend). The system returns exactly to the state before
implementation.

### Partial rollback: keep backend, disable frontend rendering
Remove only the `MessageBubble.tsx` changes (Step 14). The SSE event will still
be emitted and handled by `chatStore`, but nothing renders. Safe if you want to
pause rendering while keeping the plumbing.

### Partial rollback: keep standalone tool, remove sandbox support
Remove the `runner.py` `show_component()` function and the `run_python.py`
loop (Steps 3 + 4). The agent can still call `show_component` as a direct tool
call but cannot use it inside `run_python` code.

### Partial rollback: keep sandbox support, remove standalone tool
Delete `show_component.py` and revert Steps 5 + 6. Agents must use `run_python`
with `show_component()` inside — no direct tool call.

---

## Notes on what was NOT changed

- `backend/app/events/bus.py` — `AgentEvent.type` is an unvalidated string;
  no change needed to support the new event type.
- `backend/app/api/chat.py` — the SSE endpoint forwards all `AgentEvent` types
  generically; no change needed.
- `frontend/src/components/layout/ArtifactsPanel.tsx` — inline components
  deliberately bypass the Artifacts panel; no change.
- `frontend/src/components/workspace/DashboardRenderer.tsx` (beyond the export)
  — the main dashboard path is fully untouched.
- `frontend/src/types/index.ts` — `DashboardComponent` type is already
  `[key: string]: unknown`, covering all new component fields.
