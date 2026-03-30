import { useCallback, useRef } from "react";
import { useChatStore } from "@/stores/chatStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { streamChat } from "@/lib/sse";
import { generateId } from "@/lib/utils";
import type {
  Message,
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

/**
 * Provides the sendMessage, clearMessages, and stopGeneration actions.
 * Components that need state (messages, isStreaming, etc.) should
 * subscribe directly via `useChatStore((s) => s.field)` to avoid
 * re-render cascades.
 */
export function useChat() {
  // Use refs for settings so sendMessage doesn't need them as deps
  const settingsRef = useRef(useSettingsStore.getState());
  settingsRef.current = useSettingsStore.getState();

  // AbortController for stop generation
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    const store = useChatStore.getState();

    // Add user message
    const userMsg: Message = {
      id: generateId(),
      role: "user",
      content,
      timestamp: new Date(),
    };
    store.addMessage(userMsg);

    // Clear progress/agents/thinking/suggestions for new message
    store.clearProgress();
    store.clearAgents();
    store.clearThinking();
    store.clearSuggestions();

    // Add placeholder assistant message
    const assistantMsg: Message = {
      id: generateId(),
      role: "assistant",
      content: "",
      timestamp: new Date(),
      isStreaming: true,
    };
    store.addMessage(assistantMsg);
    store.setStreaming(true);

    const currentSessionId = store.sessionId;
    const { model, provider } = settingsRef.current;

    // Create AbortController for this request
    const controller = new AbortController();
    abortRef.current = controller;

    // Track whether we're getting token deltas (for smart message handling)
    let hasReceivedTokens = false;

    try {
      await streamChat(content, currentSessionId, model, provider, {
        onUpdate: (update: AgentUpdate) => {
          if (update.session_id) {
            useChatStore.getState().setSessionId(update.session_id);
          }
          const data = update.data;
          if (data?.messages) {
            const msgs = data.messages as any[];
            for (const msg of msgs) {
              const c = msg?.content;
              if (c && typeof c === "string" && c.trim()) {
                const msgType = msg?.type;
                if (!msgType || msgType === "ai" || msgType === "AIMessage") {
                  // If we've been receiving tokens, the full message from "updates"
                  // is authoritative — replace whatever tokens accumulated
                  useChatStore.getState().updateLastAssistantMessage(c);
                }
              }
            }
          }
        },
        onProgress: (step: ProgressStep) => {
          useChatStore.getState().addProgressStep(step);
        },
        onArtifact: (artifact: Artifact) => {
          useChatStore.getState().addArtifact(artifact);
        },
        onDashboard: (component: DashboardComponent) => {
          useChatStore.getState().addDashboardComponent(component);
        },
        onDone: (sid: string) => {
          useChatStore.getState().setSessionId(sid);
          useChatStore.getState().setStreaming(false);
        },
        onError: (error: string) => {
          useChatStore.getState().updateLastAssistantMessage(`Error: ${error}`);
          useChatStore.getState().setStreaming(false);
        },
        // Token-level streaming (typing effect)
        onTokenDelta: (event: TokenDeltaEvent) => {
          hasReceivedTokens = true;
          useChatStore.getState().appendToken(event.token);
        },
        // Thinking/planning transparency
        onThinking: (event: ThinkingEvent) => {
          useChatStore.getState().addThinking(event);
        },
        // A2A/A2UI callbacks
        onAgentStatus: (event: AgentStatusEvent) => {
          useChatStore.getState().addAgentStatus(event);
        },
        onToolStart: (event: ToolEvent) => {
          useChatStore.getState().addToolEvent(event, "start");
        },
        onToolEnd: (event: ToolEvent) => {
          useChatStore.getState().addToolEvent(event, "end");
        },
        // Subagent streaming
        onSubagentStart: (data: { agent_name: string }) => {
          useChatStore.getState().addSubagentMessageStart(data.agent_name);
        },
        onSubagentDelta: (data: { delta: string; agent_name?: string }) => {
          if (data.agent_name) {
            useChatStore.getState().appendSubagentToken(data.agent_name, data.delta);
          }
        },
        onSubagentDone: (data: { agent_name: string }) => {
          useChatStore.getState().finishSubagentMessage(data.agent_name);
        },
        onSuggestions: (chips: SuggestionChip[]) => {
          useChatStore.getState().setSuggestions(chips);
        },
        onInlineComponent: (event) => {
          useChatStore.getState().addInlineComponents({
            title: event.title,
            components: event.components,
          });
        },
      }, controller.signal);
    } catch (err: any) {
      if (err.name === "AbortError") {
        // User stopped generation
        const store = useChatStore.getState();
        const msgs = [...store.messages];
        const lastIdx = msgs.findLastIndex((m) => m.role === "assistant");
        if (lastIdx >= 0 && !msgs[lastIdx].content.trim()) {
          msgs[lastIdx] = { ...msgs[lastIdx], content: "*Generation stopped*", isStreaming: false };
          useChatStore.setState({ messages: msgs });
        }
      } else {
        useChatStore.getState().updateLastAssistantMessage(`Error: ${err.message || "Unknown error"}`);
      }
    } finally {
      abortRef.current = null;
      useChatStore.getState().setStreaming(false);
    }
  }, []);

  const stopGeneration = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const clearMessages = useCallback(() => {
    useChatStore.getState().clearMessages();
  }, []);

  return { sendMessage, clearMessages, stopGeneration };
}
