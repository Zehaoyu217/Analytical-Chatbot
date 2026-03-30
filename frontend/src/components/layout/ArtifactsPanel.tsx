import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useChatStore } from "@/stores/chatStore";
import { useChat } from "@/hooks/useChat";
import { VegaChart } from "@/components/workspace/VegaChart";
import { MermaidDiagram } from "@/components/workspace/MermaidDiagram";
import { funText } from "@/lib/funText";
import type { Artifact } from "@/types";

const typeColor: Record<string, string> = {
  chart: "#6366f1",
  table: "#10b981",
  diagram: "#8b5cf6",
};
const typeIcon: Record<string, string> = {
  chart: "bar_chart",
  table: "table_chart",
  diagram: "schema",
};

export function ArtifactsPanel() {
  const artifacts = useChatStore((s) => s.artifacts);
  const { sendMessage } = useChat();

  if (artifacts.length === 0) {
    return (
      <div className="px-4 py-8 text-center flex-1">
        <span className="material-symbols-rounded text-[var(--icon-xl)] text-[var(--text-muted)] block mb-2 opacity-40">
          inventory_2
        </span>
        <p className="text-[12px] text-[var(--text-muted)]">
          {funText.artifactsEmpty}
        </p>
      </div>
    );
  }

  return (
    <div className="px-3 py-2.5 space-y-2 flex-1">
      {artifacts.map((artifact) => (
        <ArtifactCard
          key={artifact.id}
          artifact={artifact}
          onSendFeedback={sendMessage}
        />
      ))}
    </div>
  );
}

function ArtifactCard({
  artifact,
  onSendFeedback,
}: {
  artifact: Artifact;
  onSendFeedback?: (message: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [sent, setSent] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const color = typeColor[artifact.type] || "#6366f1";
  const icon = typeIcon[artifact.type] || "description";

  const handleSendFeedback = () => {
    if (!feedbackText.trim() || !onSendFeedback) return;
    const msg = `Regarding the artifact "${artifact.title}" (id: ${artifact.id}): ${feedbackText.trim()}. Please update this artifact with the requested changes using update_artifact.`;
    onSendFeedback(msg);
    setSent(true);
    setFeedbackText("");
    setTimeout(() => {
      setSent(false);
      setFeedbackOpen(false);
    }, 1500);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendFeedback();
    }
    if (e.key === "Escape") {
      setFeedbackOpen(false);
      setFeedbackText("");
    }
  };

  return (
    <motion.div
      layout
      className="rounded-[var(--radius-md)] border overflow-hidden"
      style={{
        borderColor: color + "25",
        background: "var(--surface-2)",
      }}
    >
      {/* Header */}
      <div className="flex items-center">
        <button
          className="flex-1 flex items-center gap-2 px-3 py-2 border-b cursor-pointer hover:bg-[rgba(255,255,255,0.02)] transition-colors duration-150"
          style={{ borderColor: color + "15" }}
          onClick={() => setExpanded(!expanded)}
        >
          <div
            className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
            style={{ background: color + "15" }}
          >
            <span
              className="material-symbols-rounded text-[var(--icon-xs)]"
              style={{ color }}
            >
              {icon}
            </span>
          </div>
          <span className="text-[12px] font-medium text-[var(--text-primary)] flex-1 truncate text-left">
            {artifact.title || `${artifact.type} ${artifact.id}`}
          </span>
          <span
            className="material-symbols-rounded text-[var(--icon-sm)] text-[var(--text-muted)] shrink-0 transition-transform duration-150"
            style={{
              transform: expanded ? "rotate(0deg)" : "rotate(-90deg)",
            }}
          >
            expand_more
          </span>
        </button>

        {/* Refine button */}
        {onSendFeedback && !isStreaming && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setFeedbackOpen(!feedbackOpen);
              if (!feedbackOpen) {
                setTimeout(() => inputRef.current?.focus(), 100);
              }
            }}
            className={`px-2 py-2 border-b border-l transition-all duration-150 ${
              feedbackOpen
                ? "bg-indigo-500/10 text-indigo-400"
                : "text-[var(--text-muted)] hover:text-indigo-400 hover:bg-[rgba(255,255,255,0.02)]"
            }`}
            style={{ borderColor: color + "15" }}
            title="Refine this artifact"
          >
            <span className="material-symbols-rounded text-[16px]">
              edit_note
            </span>
          </button>
        )}
      </div>

      {/* Feedback input */}
      <AnimatePresence>
        {feedbackOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden border-b"
            style={{ borderColor: color + "15" }}
          >
            <div className="px-3 py-2 bg-indigo-500/5">
              {sent ? (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex items-center gap-2 py-1"
                >
                  <span className="material-symbols-rounded text-[16px] text-emerald-400">
                    check_circle
                  </span>
                  <span className="text-[12px] text-emerald-400 font-medium">
                    Feedback sent! Agent is refining...
                  </span>
                </motion.div>
              ) : (
                <div className="flex items-start gap-2">
                  <textarea
                    ref={inputRef}
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="e.g. Make the bars horizontal, add a title..."
                    rows={2}
                    className="flex-1 bg-transparent resize-none text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none leading-[1.5]"
                  />
                  <button
                    onClick={handleSendFeedback}
                    disabled={!feedbackText.trim()}
                    className="mt-0.5 w-7 h-7 rounded-md flex items-center justify-center bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 active:scale-95 transition-all duration-150 disabled:opacity-30 disabled:hover:bg-indigo-500/20 shrink-0"
                    title="Send feedback"
                  >
                    <span className="material-symbols-rounded text-[14px]">
                      send
                    </span>
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="p-3">
              {artifact.format === "vega-lite" ? (
                <VegaChart spec={artifact.content} />
              ) : artifact.format === "mermaid" ? (
                <MermaidDiagram code={artifact.content} />
              ) : (
                <div
                  className="artifact-table-container text-[12px] text-[var(--text-secondary)] overflow-auto max-h-64"
                  dangerouslySetInnerHTML={{ __html: artifact.content }}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
