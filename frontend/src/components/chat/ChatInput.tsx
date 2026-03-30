import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { funText } from "@/lib/funText";

interface Props {
  onSend: (message: string) => void;
  isStreaming: boolean;
  onClear: () => void;
  onStop: () => void;
}

export function ChatInput({ onSend, isStreaming, onStop }: Props) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus input on mount and after streaming ends
  useEffect(() => {
    if (!isStreaming) {
      textareaRef.current?.focus();
    }
  }, [isStreaming]);

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;
    onSend(input.trim());
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 200) + "px";
    }
  };

  return (
    <div className="px-6 pb-5 pt-2 shrink-0">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] focus-within:border-[var(--border-accent)] focus-within:shadow-[0_0_0_1px_rgba(99,102,241,0.15)] transition-all duration-150 min-h-[44px]">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder={funText.inputPlaceholder}
            rows={1}
            disabled={isStreaming}
            className="flex-1 bg-transparent resize-none text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none leading-[1.5] max-h-48 self-center disabled:opacity-50"
            style={{ minHeight: '24px', paddingTop: 0, paddingBottom: 0, marginTop: 0, marginBottom: 0 }}
          />

          {isStreaming ? (
            /* Stop generation button */
            <button
              onClick={onStop}
              className="w-8 h-8 rounded-lg flex items-center justify-center bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 active:scale-95 transition-all duration-150 shrink-0 self-center ring-1 ring-rose-500/30"
              title="Stop generation (Esc)"
            >
              <span className="material-symbols-rounded text-[var(--icon-md)]">stop</span>
            </button>
          ) : (
            /* Send button */
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-sm hover:shadow-[0_2px_12px_rgba(99,102,241,0.4)] hover:scale-105 active:scale-95 transition-all duration-150 disabled:opacity-25 disabled:hover:scale-100 shrink-0 self-center"
            >
              <span className="material-symbols-rounded text-[var(--icon-md)]">send</span>
            </button>
          )}
        </div>
        <p className="text-center text-[10px] text-[var(--text-muted)] mt-1.5 opacity-60">
          {isStreaming ? "Press Esc to stop · Streaming..." : funText.inputHelper}
        </p>
      </div>
    </div>
  );
}
