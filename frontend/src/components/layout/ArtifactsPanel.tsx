import { useState, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useChatStore } from "@/stores/chatStore";
import { useChat } from "@/hooks/useChat";
import { VegaChart } from "@/components/workspace/VegaChart";
import { MermaidDiagram } from "@/components/workspace/MermaidDiagram";
import { funText } from "@/lib/funText";
import type { Artifact } from "@/types";

const typeColor: Record<string, string> = {
  chart: "#d4a017",
  table: "#10b981",
  diagram: "#38bdf8",
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
      <div className="px-3.5 py-5 flex-1">
        <p className="text-[10px] font-mono text-[var(--text-dim)]">
          {funText.artifactsEmpty}
        </p>
      </div>
    );
  }

  return (
    <div className="px-2.5 py-2 space-y-1.5 flex-1">
      {artifacts.map((artifact, i) => (
        <motion.div
          key={artifact.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: i * 0.05, ease: "easeOut" }}
        >
          <ArtifactCard
            artifact={artifact}
            onSendFeedback={sendMessage}
          />
        </motion.div>
      ))}
    </div>
  );
}

/* ── Sortable/filterable table for table-json artifacts ─── */
export function TableArtifact({ content }: { content: string }) {
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filter, setFilter] = useState("");

  let columns: string[] = [];
  let rows: (string | number | boolean | null)[][] = [];
  let totalRows = 0;

  try {
    const parsed = JSON.parse(content);
    columns = parsed.columns ?? [];
    rows = parsed.rows ?? [];
    totalRows = parsed.total_rows ?? rows.length;
  } catch {
    return (
      <p className="text-[11px] text-rose-400 p-2">Failed to parse table data.</p>
    );
  }

  const handleSort = (colIdx: number) => {
    if (sortCol === colIdx) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(colIdx);
      setSortDir("asc");
    }
  };

  const displayRows = useMemo(() => {
    let result = rows;

    if (filter.trim()) {
      const q = filter.toLowerCase();
      result = result.filter((row) =>
        row.some((cell) => String(cell ?? "").toLowerCase().includes(q))
      );
    }

    if (sortCol !== null) {
      result = [...result].sort((a, b) => {
        const av = a[sortCol];
        const bv = b[sortCol];
        const isNum = av !== null && bv !== null && !isNaN(Number(av)) && !isNaN(Number(bv));
        const cmp = isNum
          ? Number(av) - Number(bv)
          : String(av ?? "").localeCompare(String(bv ?? ""));
        return sortDir === "asc" ? cmp : -cmp;
      });
    }

    return result;
  }, [rows, filter, sortCol, sortDir]);

  const isTruncated = totalRows > rows.length;
  const isFiltered = filter.trim().length > 0;

  return (
    <div className="flex flex-col gap-1.5">
      {/* Search */}
      {rows.length > 5 && (
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 material-symbols-rounded text-[12px] text-[var(--text-muted)]">
            search
          </span>
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter rows..."
            className="w-full pl-6 pr-2 py-1 text-[11px] bg-[var(--surface-3)] border border-[var(--border)] rounded-[var(--radius-sm)] text-[var(--text-secondary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--border-strong)] transition-colors"
          />
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-[var(--radius-sm)] border border-[var(--border)]">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-[var(--border-strong)]">
              {columns.map((col, i) => (
                <th
                  key={i}
                  onClick={() => handleSort(i)}
                  className="px-3 py-1.5 text-left text-[10px] font-bold uppercase tracking-[0.6px] text-[var(--text-muted)] bg-[var(--surface-3)] whitespace-nowrap cursor-pointer select-none hover:text-[var(--text-secondary)] transition-colors"
                >
                  <span className="flex items-center gap-1">
                    {col}
                    {sortCol === i ? (
                      <span className="material-symbols-rounded text-[10px] text-[var(--text-accent)]">
                        {sortDir === "asc" ? "arrow_upward" : "arrow_downward"}
                      </span>
                    ) : (
                      <span className="material-symbols-rounded text-[10px] opacity-0 group-hover:opacity-30">
                        unfold_more
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, i) => (
              <tr
                key={i}
                className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--surface-3)] transition-colors duration-75"
              >
                {row.map((cell, j) => (
                  <td
                    key={j}
                    className="px-3 py-1.5 text-[11px] font-mono tabular-nums text-[var(--text-primary)] whitespace-nowrap"
                  >
                    {cell === null ? (
                      <span className="text-[var(--text-muted)] italic">null</span>
                    ) : (
                      String(cell)
                    )}
                  </td>
                ))}
              </tr>
            ))}
            {displayRows.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-4 text-center text-[11px] text-[var(--text-muted)]"
                >
                  {isFiltered ? "No rows match filter" : "No data"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 text-[10px] font-mono text-[var(--text-muted)]">
        {isFiltered ? (
          <span>{displayRows.length} of {rows.length} rows match</span>
        ) : (
          <span>{displayRows.length} rows</span>
        )}
        {isTruncated && !isFiltered && (
          <span className="text-amber-400/60">· {totalRows} total — showing first {rows.length}</span>
        )}
        {sortCol !== null && (
          <>
            <span>·</span>
            <button
              onClick={() => { setSortCol(null); setSortDir("asc"); }}
              className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
            >
              clear sort
            </button>
          </>
        )}
      </div>
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
  const color = typeColor[artifact.type] || "#8494ad"; // --text-secondary fallback
  const icon = typeIcon[artifact.type] || "description";

  const handleSendFeedback = () => {
    if (!feedbackText.trim() || !onSendFeedback) return;
    const artifactType = artifact.format === "vega-lite" ? "chart" : artifact.format === "mermaid" ? "diagram" : "table";
    const msg = `ARTIFACT REFINEMENT REQUEST — artifact id: ${artifact.id} ("${artifact.title}", ${artifactType})

User change requested: ${feedbackText.trim()}

Execute this in a SINGLE run_python call — do NOT describe anything, just run the code:

\`\`\`python
# Step 1: Read the current spec
import json
from app.agent.tools.save_artifact import get_artifact_content  # NOT needed — already in context

# Get the artifact content first via get_artifact_content("${artifact.id}"), then:
# Step 2: Rebuild or modify the chart, then update in-place using the sandbox helper:

# Example for chart refinement:
# chart = alt.Chart(df).mark_bar(...).encode(...)     # rebuild with changes
# chart = gs_theme(chart, "${artifact.title}")
# update_artifact("${artifact.id}", chart)             # ← updates the existing artifact, panel refreshes instantly

# update_artifact() accepts: Altair chart object, vega-lite dict, or JSON string
# DO NOT use save_artifact() — that creates a NEW artifact instead of updating this one
# DO NOT call chart.to_dict() before passing to update_artifact() — pass the chart object directly
\`\`\`

Required steps:
1. Call get_artifact_content("${artifact.id}") to read the current spec and data context
2. Call run_python — rebuild/modify the ${artifactType}, end with update_artifact("${artifact.id}", chart)
Do NOT skip either step. Execute now.`;
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
      className="rounded-[var(--radius-sm)] border overflow-hidden"
      style={{
        borderColor: color + "20",
        background: "var(--surface-2)",
      }}
    >
      {/* Header */}
      <div className="flex items-center">
        <button
          className="flex-1 flex items-center gap-2 px-2.5 py-1.5 border-b cursor-pointer hover:bg-[rgba(255,255,255,0.02)] transition-colors duration-150"
          style={{ borderColor: color + "12" }}
          onClick={() => setExpanded(!expanded)}
        >
          <span
            className="material-symbols-rounded text-[13px] shrink-0"
            style={{ color: color + "90" }}
          >
            {icon}
          </span>
          <span className="text-[11px] font-mono font-medium text-[var(--text-primary)] flex-1 truncate text-left">
            {artifact.title || `${artifact.type} ${artifact.id}`}
          </span>
          <span
            className="material-symbols-rounded text-[13px] text-[var(--text-dim)] shrink-0 transition-transform duration-150"
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
                ? "bg-amber-500/10 text-amber-400"
                : "text-[var(--text-muted)] hover:text-amber-400 hover:bg-[rgba(255,255,255,0.02)]"
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
            <div className="px-3 py-2 bg-amber-500/5">
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
                    className="mt-0.5 w-7 h-7 rounded-md flex items-center justify-center bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 active:scale-95 transition-all duration-150 disabled:opacity-30 disabled:hover:bg-amber-500/15 shrink-0"
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
              ) : artifact.format === "table-json" ? (
                <TableArtifact content={artifact.content} />
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
