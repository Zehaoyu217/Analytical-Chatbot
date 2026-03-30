export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  figures?: string[];
  isStreaming?: boolean;
  /** IDs of artifacts created during this message's generation */
  artifactIds?: string[];
  /** Inline A2UI component groups rendered inside this message bubble */
  inlineComponentGroups?: InlineComponentGroup[];
  /** Chain of thought reasoning produced by the agent */
  thoughtProcess?: string;
}

export interface SubagentMessage {
  id: string;
  agent_name: string;
  content: string;
  isStreaming?: boolean;
  timestamp: Date;
}

export interface Dataset {
  table_name: string;
  file_name: string;
  row_count: number;
  column_count: number;
  created_at: string;
}

export interface DatasetSchema {
  table_name: string;
  schema: ColumnDef[];
}

export interface ColumnDef {
  name: string;
  type: string;
  nullable: string;
}

export interface LLMModel {
  provider: string;
  model: string;
  name: string;
  local: boolean;
}

export interface ChatSession {
  id: string;
}

export interface SSEEvent {
  event: string;
  data: string;
}

export interface AgentUpdate {
  node: string;
  data: Record<string, unknown>;
  session_id: string;
}

export interface UploadResult {
  table_name: string;
  file_name: string;
  rows: number;
  columns: number;
  schema: ColumnDef[];
}

// Progress tracking
export interface ProgressStep {
  id: string;
  label: string;
  status: "pending" | "running" | "done" | "error";
  detail: string;
  started_at: number | null;
  finished_at: number | null;
  // A2UI enrichment
  agent_id?: string;
  parent_agent_id?: string | null;
  result_preview?: string;
  /** Preserved original args_preview (survives tool_end detail overwrite) */
  args_preview?: string;
  type?: "node" | "agent" | "tool";
  /** What the model decided to do after thinking (e.g., "Calling run_python") */
  decision?: string;
}

// Artifacts
export interface Artifact {
  id: string;
  type: "table" | "chart" | "diagram" | "dashboard_component";
  title: string;
  content: string;
  format: "html" | "vega-lite" | "mermaid" | "table-json";
  created_at: number;
  metadata: Record<string, unknown>;
}

// Dashboard components
export interface DashboardComponent {
  _title?: string;
  type: string;
  [key: string]: unknown;
}

export interface InlineComponentGroup {
  id: string;
  title?: string;
  components: DashboardComponent[];
}

// A2A: Agent status events (sub-agent lifecycle)
export interface AgentStatusEvent {
  agent_name: string;
  agent_id?: string;
  parent_agent_id?: string | null;
  status: "started" | "completed" | "failed";
  task?: string;
  tool_calls?: number;
  elapsed_s?: number;
  error?: string;
}

// A2UI: Tool execution events (granular tool-level progress)
export interface ToolEvent {
  agent_id?: string;
  parent_agent_id?: string | null;
  tool: string;
  args_preview?: string;
  elapsed_s?: number;
  result_preview?: string;
}

// Token-level streaming
export interface TokenDeltaEvent {
  token: string;
  agent_id?: string;
}

// Agent thinking/planning transparency
export interface TodoItem {
  text: string;
  status: "pending" | "running" | "done";
}

export interface ThinkingEvent {
  kind: "plan" | "delegation" | "reasoning" | "todo_update";
  label: string;
  items?: string[];          // Legacy: flat text items
  todoItems?: TodoItem[];    // Structured: items with status
  agent?: string;
  task?: string;
}

// Follow-up suggestion chips
export interface SuggestionChip {
  label: string;
  prompt: string;
  icon?: string;
}
