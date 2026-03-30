import type {
  AgentUpdate,
  ProgressStep,
  Artifact,
  DashboardComponent,
  AgentStatusEvent,
  ToolEvent,
  TokenDeltaEvent,
  ThinkingEvent,
  SuggestionChip,
} from "@/types";

export interface SSECallbacks {
  onUpdate: (update: AgentUpdate) => void;
  onProgress: (step: ProgressStep) => void;
  onArtifact: (artifact: Artifact) => void;
  onDashboard: (component: DashboardComponent) => void;
  onDone: (sessionId: string) => void;
  onError: (error: string) => void;
  // A2A/A2UI event callbacks
  onAgentStatus?: (event: AgentStatusEvent) => void;
  onToolStart?: (event: ToolEvent) => void;
  onToolEnd?: (event: ToolEvent) => void;
  // Token streaming + thinking transparency
  onTokenDelta?: (event: TokenDeltaEvent) => void;
  onThoughtStream?: (event: TokenDeltaEvent) => void;
  onThinking?: (event: ThinkingEvent) => void;
  // Subagent streaming
  onSubagentStart?: (data: { agent_name: string }) => void;
  onSubagentDelta?: (data: { delta: string; agent_name?: string }) => void;
  onSubagentDone?: (data: { agent_name: string }) => void;
  // Follow-up suggestions
  onSuggestions?: (chips: SuggestionChip[]) => void;
  // Inline A2UI components rendered in chat bubbles
  onInlineComponent?: (event: { components: DashboardComponent[]; title?: string }) => void;
}

export async function streamChat(
  message: string,
  sessionId: string | null,
  model: string | null,
  provider: string | null,
  callbacks: SSECallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      session_id: sessionId,
      model,
      provider,
    }),
    signal,
  });

  if (!res.ok) {
    callbacks.onError(`Request failed: ${res.statusText}`);
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) {
    callbacks.onError("No response body");
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let currentEvent = "message";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("event: ")) {
        currentEvent = line.slice(7).trim();
        continue;
      }
      if (line.startsWith("data: ")) {
        const dataStr = line.slice(6);
        try {
          const data = JSON.parse(dataStr);

          switch (currentEvent) {
            case "progress":
              callbacks.onProgress(data as ProgressStep);
              break;
            case "artifact":
              callbacks.onArtifact(data as Artifact);
              break;
            case "dashboard":
              callbacks.onDashboard(data as DashboardComponent);
              break;
            case "error":
              callbacks.onError(data.error || "Unknown error");
              break;
            case "done":
              callbacks.onDone(data.session_id);
              break;
            // A2A/A2UI events
            case "agent_status":
              callbacks.onAgentStatus?.(data as AgentStatusEvent);
              break;
            case "tool_start":
              callbacks.onToolStart?.(data as ToolEvent);
              break;
            case "tool_end":
              callbacks.onToolEnd?.(data as ToolEvent);
              break;
            case "token_delta":
              callbacks.onTokenDelta?.(data as TokenDeltaEvent);
              break;
            case "thought_stream":
              callbacks.onThoughtStream?.(data as TokenDeltaEvent);
              break;
            case "thinking":
              callbacks.onThinking?.(data as ThinkingEvent);
              break;
            case "subagent_update_start":
              callbacks.onSubagentStart?.(data as { agent_name: string });
              break;
            case "subagent_update_delta":
              callbacks.onSubagentDelta?.(data as { delta: string; agent_name?: string });
              break;
            case "subagent_update_done":
              callbacks.onSubagentDone?.(data as { agent_name: string });
              break;
            case "suggestions":
              callbacks.onSuggestions?.(data.chips as SuggestionChip[]);
              break;
            case "inline_component":
              callbacks.onInlineComponent?.(data as { components: DashboardComponent[]; title?: string });
              break;
            case "message":
            default:
              if (data.error) {
                callbacks.onError(data.error);
              } else {
                callbacks.onUpdate(data as AgentUpdate);
              }
              break;
          }
        } catch {
          // Skip malformed JSON
        }
        currentEvent = "message"; // reset
      }
    }
  }
}
