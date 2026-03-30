import { useEffect, useCallback } from "react";
import { useChat } from "@/hooks/useChat";
import { useChatStore } from "@/stores/chatStore";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { funText } from "@/lib/funText";
import { SuggestionChips } from "./SuggestionChips";
import { AgentActivityToasts } from "@/components/layout/AgentActivityToasts";
import { AgentParticles } from "@/components/layout/AgentParticles";

export function ChatContainer() {
  const { sendMessage, clearMessages, stopGeneration } = useChat();
  // Only subscribe to the boolean — avoid re-renders from message content changes
  const hasMessages = useChatStore((s) => s.messages.length > 0);
  const isStreaming = useChatStore((s) => s.isStreaming);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl+K — new chat
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        clearMessages();
      }
      // Escape — stop generation
      if (e.key === "Escape" && useChatStore.getState().isStreaming) {
        e.preventDefault();
        stopGeneration();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [clearMessages, stopGeneration]);

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[var(--surface-1)] relative">
      {/* Ambient particles during agent work */}
      <AgentParticles />

      {/* Header */}
      <header className="h-11 px-5 flex items-center justify-between shrink-0 border-b border-[var(--border)] relative z-20">
        <div className="flex items-center gap-2">
          <span className="material-symbols-rounded text-[var(--icon-md)] text-indigo-400">
            query_stats
          </span>
          <span className="text-[13px] font-semibold text-[var(--text-primary)] tracking-[-0.2px]">
            {funText.chatTitle}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={clearMessages}
            className="h-7 px-2.5 rounded-lg text-[11px] font-medium bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text-accent)] border border-[var(--border)] hover:border-[var(--border-accent)] transition-all duration-150 flex items-center gap-1.5"
            title="New chat (⌘K)"
          >
            <span className="material-symbols-rounded text-[var(--icon-sm)]">add</span>
            {funText.newChatLabel}
          </button>
        </div>
      </header>

      {/* Messages or empty state */}
      {!hasMessages ? (
        <EmptyState onSuggestion={sendMessage} />
      ) : (
        <MessageList />
      )}

      <SuggestionChips onSend={sendMessage} />

      <ChatInput
        onSend={sendMessage}
        isStreaming={isStreaming}
        onClear={clearMessages}
        onStop={stopGeneration}
      />

      {/* Floating activity toasts */}
      <AgentActivityToasts />
    </div>
  );
}

function EmptyState({ onSuggestion }: { onSuggestion: (msg: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 px-6">
      {/* Aurora orb with float animation */}
      <div className="relative w-14 h-14 mb-5" style={{ animation: "aurora-float 4s ease-in-out infinite" }}>
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-cyan-400 opacity-50 blur-xl animate-pulse" />
        <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-cyan-400 flex items-center justify-center shadow-[0_0_30px_rgba(99,102,241,0.3)]">
          <span className="material-symbols-rounded text-white text-[var(--icon-xl)]">
            auto_awesome
          </span>
        </div>
      </div>

      <h2 className="text-[18px] font-semibold text-[var(--text-primary)] tracking-[-0.3px] text-center">
        {funText.emptyHeading}
      </h2>
      <p className="text-[13px] text-[var(--text-muted)] mt-1.5 text-center max-w-[300px] leading-[1.5]">
        {funText.emptySubtext}
      </p>

      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {funText.suggestions.map(({ icon, text }, i) => (
          <button
            key={text}
            onClick={() => onSuggestion(text)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] hover:border-[var(--border-accent)] text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-accent)] transition-all duration-150 animate-slide-up"
            style={{ animationDelay: `${i * 60}ms`, animationFillMode: "backwards" }}
          >
            <span className="material-symbols-rounded text-[var(--icon-sm)]">{icon}</span>
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
