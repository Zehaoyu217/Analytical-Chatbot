import { useEffect } from "react";
import { useChat } from "@/hooks/useChat";
import { useChatStore } from "@/stores/chatStore";
import { useDatasets } from "@/hooks/useDatasets";
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
  const { data: datasets } = useDatasets();
  const hasDatasets = (datasets?.length ?? 0) > 0;

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
      <header className="h-10 px-4 flex items-center justify-between shrink-0 border-b border-[var(--border)] relative z-20">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-mono font-medium text-[var(--text-muted)] tracking-[0.5px] uppercase">
            {funText.chatTitle}
          </span>
        </div>
        <button
          onClick={clearMessages}
          className="h-6 px-2 rounded-[var(--radius-sm)] text-[10px] font-mono font-medium text-[var(--text-muted)] hover:text-[var(--text-accent)] border border-[var(--border)] hover:border-[var(--border-accent)] transition-all duration-150 flex items-center gap-1"
          title="New chat (⌘K)"
        >
          <span className="material-symbols-rounded text-[12px]">add</span>
          {funText.newChatLabel}
        </button>
      </header>

      {/* Messages or empty state */}
      {!hasMessages ? (
        <EmptyState onSuggestion={sendMessage} hasDatasets={hasDatasets} />
      ) : (
        <MessageList onRetry={sendMessage} />
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

const GENERIC_SUGGESTIONS = [
  { icon: "functions", text: "Show basic statistics for all columns" },
  { icon: "show_chart", text: "Plot a line chart of the first numeric column over time" },
  { icon: "table_chart", text: "Show the first 10 rows as a table" },
  { icon: "bar_chart", text: "Which values appear most often? Show a bar chart." },
];

function EmptyState({
  onSuggestion,
  hasDatasets,
}: {
  onSuggestion: (msg: string) => void;
  hasDatasets: boolean;
}) {
  const suggestions = hasDatasets ? funText.suggestions : GENERIC_SUGGESTIONS;

  return (
    <div className="flex flex-col items-start justify-center flex-1 px-8 max-w-2xl mx-auto w-full">
      <h2 className="text-[22px] font-extrabold text-[var(--text-primary)] tracking-[-0.5px] leading-tight">
        {funText.emptyHeading}
      </h2>
      <p className="text-[13px] text-[var(--text-muted)] mt-2 leading-[1.6] max-w-[380px]">
        {hasDatasets
          ? funText.emptySubtext
          : "Upload a CSV, Excel, or Parquet file using the left panel, then ask anything about your data."}
      </p>

      {/* Step indicator when no data loaded */}
      {!hasDatasets && (
        <div className="mt-4 flex items-center gap-2 text-[11px] font-mono text-[var(--text-muted)]">
          <span className="text-amber-400/70 font-bold">01</span>
          <span>upload</span>
          <span className="text-[var(--text-dim)]">—</span>
          <span className="text-[var(--text-dim)] font-bold">02</span>
          <span className="text-[var(--text-dim)]">query</span>
          <span className="text-[var(--text-dim)]">—</span>
          <span className="text-[var(--text-dim)] font-bold">03</span>
          <span className="text-[var(--text-dim)]">insight</span>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-1.5">
        {suggestions.map(({ icon, text }, i) => (
          <button
            key={text}
            onClick={() => onSuggestion(text)}
            disabled={!hasDatasets}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--surface-2)] border border-[var(--border)] hover:border-[var(--border-accent)] text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-accent)] transition-all duration-150 animate-slide-up disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-[var(--border)] disabled:hover:text-[var(--text-secondary)]"
            style={{ animationDelay: `${i * 60}ms`, animationFillMode: "backwards" }}
            title={!hasDatasets ? "Upload a dataset first" : undefined}
          >
            <span className="material-symbols-rounded text-[13px] opacity-60">{icon}</span>
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
