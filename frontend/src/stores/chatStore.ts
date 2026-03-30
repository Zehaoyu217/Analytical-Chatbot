import { create } from "zustand";
import type {
  Message,
  ProgressStep,
  Artifact,
  DashboardComponent,
  InlineComponentGroup,
  AgentStatusEvent,
  ToolEvent,
  ThinkingEvent,
  SuggestionChip,
  SubagentMessage,
} from "@/types";

interface ChatState {
  messages: Message[];
  sessionId: string | null;
  isStreaming: boolean;

  // Progress tracking
  progressSteps: ProgressStep[];

  // Artifacts
  artifacts: Artifact[];

  // Dashboard
  dashboardComponents: DashboardComponent[];

  // A2A: Active sub-agents
  activeAgents: AgentStatusEvent[];

  // Agent thinking/planning
  thinkingSteps: ThinkingEvent[];

  // Follow-up suggestions
  suggestions: SuggestionChip[];

  // Subagent parallel messages
  subagentMessages: SubagentMessage[];

  // Actions
  addMessage: (message: Message) => void;
  updateLastAssistantMessage: (content: string) => void;
  appendToken: (token: string) => void;
  appendThoughtToken: (token: string) => void;
  setStreaming: (streaming: boolean) => void;
  setSessionId: (id: string) => void;
  clearMessages: () => void;

  // Progress
  addProgressStep: (step: ProgressStep) => void;
  clearProgress: () => void;

  // Artifacts
  addArtifact: (artifact: Artifact) => void;
  clearArtifacts: () => void;

  // Dashboard
  addDashboardComponent: (component: DashboardComponent) => void;
  clearDashboard: () => void;

  // A2A/A2UI
  addAgentStatus: (event: AgentStatusEvent) => void;
  addToolEvent: (event: ToolEvent, phase: "start" | "end") => void;
  clearAgents: () => void;

  // Thinking
  addThinking: (event: ThinkingEvent) => void;
  clearThinking: () => void;

  // Suggestions
  setSuggestions: (chips: SuggestionChip[]) => void;
  clearSuggestions: () => void;

  // Inline components
  addInlineComponents: (group: Omit<InlineComponentGroup, "id">) => void;

  // Subagents
  addSubagentMessageStart: (agent_name: string) => void;
  appendSubagentToken: (agent_name: string, token: string) => void;
  finishSubagentMessage: (agent_name: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  sessionId: null,
  isStreaming: false,
  progressSteps: [],
  artifacts: [],
  dashboardComponents: [],
  activeAgents: [],
  thinkingSteps: [],
  suggestions: [],
  subagentMessages: [],

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  updateLastAssistantMessage: (content) =>
    set((state) => {
      const messages = [...state.messages];
      const lastIdx = messages.findLastIndex((m) => m.role === "assistant");
      if (lastIdx >= 0) {
        messages[lastIdx] = { ...messages[lastIdx], content, isStreaming: true };
      }
      return { messages };
    }),

  appendToken: (token) =>
    set((state) => {
      const messages = [...state.messages];
      const lastIdx = messages.findLastIndex((m) => m.role === "assistant");
      if (lastIdx >= 0) {
        messages[lastIdx] = {
          ...messages[lastIdx],
          content: messages[lastIdx].content + token,
          isStreaming: true,
        };
      }
      return { messages };
    }),

  appendThoughtToken: (token) =>
    set((state) => {
      const messages = [...state.messages];
      const lastIdx = messages.findLastIndex((m) => m.role === "assistant");
      if (lastIdx >= 0) {
        messages[lastIdx] = {
          ...messages[lastIdx],
          thoughtProcess: (messages[lastIdx].thoughtProcess || "") + token,
          isStreaming: true,
        };
      }
      return { messages };
    }),

  setStreaming: (isStreaming) =>
    set((state) => {
      if (!isStreaming) {
        const messages = [...state.messages];
        const lastIdx = messages.findLastIndex((m) => m.role === "assistant");
        if (lastIdx >= 0) {
          messages[lastIdx] = { ...messages[lastIdx], isStreaming: false };
        }
        return { isStreaming, messages };
      }
      return { isStreaming };
    }),
  setSessionId: (sessionId) => set({ sessionId }),

  clearMessages: () =>
    set({
      messages: [],
      sessionId: null,
      progressSteps: [],
      artifacts: [],
      dashboardComponents: [],
      activeAgents: [],
      thinkingSteps: [],
      suggestions: [],
      subagentMessages: [],
    }),

  addProgressStep: (step) =>
    set((state) => {
      const enriched = { ...step, type: step.type || ("node" as const) };
      // Upsert: if a step with the same id exists, update it in place
      if (step.id) {
        const existingIdx = state.progressSteps.findIndex((s) => s.id === step.id);
        if (existingIdx >= 0) {
          const updated = [...state.progressSteps];
          // Preserve original started_at when transitioning from running → done
          const original = updated[existingIdx];
          // When a thinking step finishes with a detail, treat it as the "decision"
          const isThinkingDone = original.label === "Thinking..." && enriched.status === "done" && enriched.detail;
          updated[existingIdx] = {
            ...enriched,
            started_at: enriched.started_at || original.started_at,
            decision: isThinkingDone ? enriched.detail : original.decision,
          };
          return { progressSteps: updated };
        }
      }
      return { progressSteps: [...state.progressSteps, enriched] };
    }),

  clearProgress: () => set({ progressSteps: [] }),

  addArtifact: (artifact) =>
    set((state) => {
      // Check if artifact already exists (update case)
      const existingIdx = state.artifacts.findIndex((a) => a.id === artifact.id);
      let newArtifacts: Artifact[];
      if (existingIdx >= 0) {
        newArtifacts = [...state.artifacts];
        newArtifacts[existingIdx] = artifact;
        return { artifacts: newArtifacts };
      }

      // New artifact — associate with the current streaming assistant message
      newArtifacts = [...state.artifacts, artifact];
      const messages = [...state.messages];
      const lastIdx = messages.findLastIndex(
        (m) => m.role === "assistant" && m.isStreaming
      );
      if (lastIdx >= 0) {
        const msg = messages[lastIdx];
        messages[lastIdx] = {
          ...msg,
          artifactIds: [...(msg.artifactIds || []), artifact.id],
        };
      }
      return { artifacts: newArtifacts, messages };
    }),

  clearArtifacts: () => set({ artifacts: [] }),

  addDashboardComponent: (component) =>
    set((state) => ({
      dashboardComponents: [...state.dashboardComponents, component],
    })),

  clearDashboard: () => set({ dashboardComponents: [] }),

  // A2A: Transform agent_status events into progress steps
  addAgentStatus: (event) =>
    set((state) => {
      const newAgents = [...state.activeAgents];
      const stepId = `agent-${event.agent_id || event.agent_name}`;

      if (event.status === "started") {
        newAgents.push(event);
        const step: ProgressStep = {
          id: stepId,
          label: `Agent: ${event.agent_name}`,
          status: "running",
          detail: event.task || "",
          started_at: Date.now() / 1000,
          finished_at: null,
          agent_id: event.agent_id,
          parent_agent_id: event.parent_agent_id,
          type: "agent",
        };
        return {
          activeAgents: newAgents,
          progressSteps: [...state.progressSteps, step],
        };
      }

      if (event.status === "completed" || event.status === "failed") {
        const updatedSteps = state.progressSteps.map((s) => {
          if (s.id === stepId) {
            return {
              ...s,
              status: event.status === "completed" ? ("done" as const) : ("error" as const),
              detail: event.status === "completed"
                ? `${event.tool_calls || 0} tool calls in ${event.elapsed_s || 0}s`
                : event.error || "Failed",
              finished_at: Date.now() / 1000,
            };
          }
          return s;
        });
        return {
          activeAgents: newAgents.filter(
            (a) => a.agent_id !== event.agent_id
          ),
          progressSteps: updatedSteps,
        };
      }

      return {};
    }),

  // A2UI: Transform tool events into progress steps
  addToolEvent: (event, phase) =>
    set((state) => {
      if (phase === "start") {
        const stepId = `tool-${event.agent_id}-${event.tool}-${Date.now()}`;
        const step: ProgressStep = {
          id: stepId,
          label: event.tool,
          status: "running",
          detail: event.args_preview || "",
          args_preview: event.args_preview || "",
          started_at: Date.now() / 1000,
          finished_at: null,
          agent_id: event.agent_id,
          parent_agent_id: event.parent_agent_id,
          type: "tool",
        };
        return { progressSteps: [...state.progressSteps, step] };
      }

      // For "end", find the last running step for this tool+agent and update it
      const steps = [...state.progressSteps];
      for (let i = steps.length - 1; i >= 0; i--) {
        const s = steps[i];
        if (
          s.label === event.tool &&
          s.status === "running" &&
          s.agent_id === event.agent_id
        ) {
          steps[i] = {
            ...s,
            status: "done",
            detail: `${event.elapsed_s}s`,
            result_preview: event.result_preview,
            finished_at: Date.now() / 1000,
          };
          break;
        }
      }
      return { progressSteps: steps };
    }),

  clearAgents: () => set({ activeAgents: [] }),

  // Thinking/planning transparency
  addThinking: (event) =>
    set((state) => {
      // For both plan and todo_update events, replace the existing plan entry to create a live-updating list
      if (event.kind === "plan" || event.kind === "todo_update") {
        const planIdx = state.thinkingSteps.findIndex((s) => s.kind === "plan" || s.kind === "todo_update");
        let todoItems = event.todoItems;
        if (!todoItems && event.items) {
          todoItems = event.items.map((text) => ({ text, status: "pending" as const }));
        }

        if (planIdx >= 0) {
          const updated = [...state.thinkingSteps];
          updated[planIdx] = { ...updated[planIdx], kind: event.kind, todoItems: todoItems || updated[planIdx].todoItems };
          return { thinkingSteps: updated };
        }
        // No existing plan — treat as new plan
        return { thinkingSteps: [...state.thinkingSteps, { ...event, todoItems }] };
      }
      // For plan events, also populate todoItems from items if not present

      return { thinkingSteps: [...state.thinkingSteps, event] };
    }),

  clearThinking: () => set({ thinkingSteps: [] }),

  // Suggestion chips
  setSuggestions: (suggestions) => set({ suggestions }),
  clearSuggestions: () => set({ suggestions: [] }),

  // Inline components — attach group to the current streaming assistant message
  addInlineComponents: (group) =>
    set((state) => {
      const newGroup: InlineComponentGroup = {
        ...group,
        id: crypto.randomUUID(),
      };
      const messages = [...state.messages];
      const lastIdx = messages.findLastIndex(
        (m) => m.role === "assistant" && m.isStreaming
      );
      if (lastIdx >= 0) {
        const msg = messages[lastIdx];
        messages[lastIdx] = {
          ...msg,
          inlineComponentGroups: [...(msg.inlineComponentGroups || []), newGroup],
        };
      }
      return { messages };
    }),
  // Subagents
  addSubagentMessageStart: (agent_name) =>
    set((state) => {
      const newMessage: SubagentMessage = {
        id: crypto.randomUUID(),
        agent_name,
        content: "",
        isStreaming: true,
        timestamp: new Date(),
      };
      return { subagentMessages: [...state.subagentMessages, newMessage] };
    }),

  appendSubagentToken: (agent_name, token) =>
    set((state) => {
      const messages = [...state.subagentMessages];
      const lastIdx = messages.findLastIndex((m) => m.agent_name === agent_name && m.isStreaming);
      if (lastIdx >= 0) {
        messages[lastIdx] = {
          ...messages[lastIdx],
          content: messages[lastIdx].content + token,
        };
      }
      return { subagentMessages: messages };
    }),

  finishSubagentMessage: (agent_name) =>
    set((state) => {
      const messages = [...state.subagentMessages];
      const lastIdx = messages.findLastIndex((m) => m.agent_name === agent_name && m.isStreaming);
      if (lastIdx >= 0) {
        messages[lastIdx] = {
          ...messages[lastIdx],
          isStreaming: false,
        };
      }
      return { subagentMessages: messages };
    }),
}));
