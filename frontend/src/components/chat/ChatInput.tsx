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
    <div className="px-5 pb-4 pt-1.5 shrink-0">
      <div className="max-w-3xl mx-auto">
        <div className={`flex items-center gap-2 px-3 py-2 rounded-[var(--radius-sm)] bg-[var(--surface-2)] border transition-all duration-200 min-h-[40px] ${
            isStreaming
              ? "input-streaming border-[var(--border)]"
              : "border-[var(--border)] focus-within:border-[var(--border-accent)]"
          }`}>
          <span className={`text-[13px] font-mono font-medium shrink-0 self-center select-none ${isStreaming ? "text-amber-400/40 animate-pulse" : "text-amber-400/60"}`}>
            &gt;
          </span>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder={funText.inputPlaceholder}
            rows={1}
            disabled={isStreaming}
            className="flex-1 bg-transparent resize-none text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none leading-[1.5] max-h-48 self-center disabled:opacity-40"
            style={{ minHeight: '24px', paddingTop: 0, paddingBottom: 0, marginTop: 0, marginBottom: 0 }}
          />

          {isStreaming ? (
            <button
              onClick={onStop}
              className="w-7 h-7 rounded-[var(--radius-sm)] flex items-center justify-center bg-rose-500/12 text-rose-400 hover:bg-rose-500/20 active:scale-95 transition-all duration-150 shrink-0 self-center border border-rose-500/25"
              title="Stop generation (Esc)"
            >
              <span className="material-symbols-rounded text-[var(--icon-sm)]">stop</span>
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="w-7 h-7 rounded-[var(--radius-sm)] flex items-center justify-center text-amber-400 border border-amber-500/30 bg-amber-500/8 hover:bg-amber-500/18 hover:border-amber-500/50 active:scale-95 transition-all duration-150 disabled:opacity-20 disabled:hover:bg-amber-500/8 shrink-0 self-center"
            >
              <span className="material-symbols-rounded text-[var(--icon-sm)]">arrow_upward</span>
            </button>
          )}
        </div>
        <p className="text-center text-[10px] text-[var(--text-muted)] mt-1 opacity-50 font-mono">
          {isStreaming ? "esc to stop · streaming" : funText.inputHelper}
        </p>
      </div>
    </div>
  );
}
