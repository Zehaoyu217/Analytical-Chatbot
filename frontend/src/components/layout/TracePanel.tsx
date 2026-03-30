import { useState } from "react";
import { useChatStore } from "@/stores/chatStore";
import { funText } from "@/lib/funText";
import type { ProgressStep } from "@/types";

function formatTime(ts: number | null): string {
  if (!ts) return "";
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatElapsed(startedAt: number | null, finishedAt: number | null): string {
  if (!startedAt || !finishedAt) return "";
  const s = finishedAt - startedAt;
  if (s < 1) return `${Math.round(s * 1000)}ms`;
  return `${s.toFixed(2)}s`;
}

const STATUS_COLORS: Record<string, string> = {
  running: "text-indigo-400 bg-indigo-500/10",
  done: "text-emerald-400 bg-emerald-500/10",
  error: "text-rose-400 bg-rose-500/10",
  pending: "text-[var(--text-muted)] bg-[var(--surface-3)]",
};

function TraceEntry({ step, index }: { step: ProgressStep; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const statusColor = STATUS_COLORS[step.status] || STATUS_COLORS.pending;
  const elapsed = formatElapsed(step.started_at, step.finished_at);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const text = JSON.stringify(step, null, 2);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="border-b border-[var(--border)] last:border-b-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[rgba(255,255,255,0.02)] transition-colors text-left"
      >
        {/* Index */}
        <span className="text-[9px] font-mono text-[var(--text-muted)] w-5 text-right shrink-0">
          {index + 1}
        </span>

        {/* Status badge */}
        <span className={`text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded ${statusColor} shrink-0`}>
          {step.status}
        </span>

        {/* Type badge */}
        {step.type && (
          <span className="text-[9px] font-mono text-[var(--text-muted)] bg-[var(--surface-3)] px-1 py-0.5 rounded shrink-0">
            {step.type}
          </span>
        )}

        {/* Label */}
        <span className="text-[11px] font-medium text-[var(--text-primary)] truncate flex-1">
          {step.label}
        </span>

        {/* Elapsed */}
        {elapsed && (
          <span className="text-[9px] font-mono text-emerald-400/60 shrink-0">
            {elapsed}
          </span>
        )}

        {/* Time */}
        <span className="text-[9px] font-mono text-[var(--text-muted)] shrink-0">
          {formatTime(step.started_at)}
        </span>

        {/* Chevron */}
        <span
          className="material-symbols-rounded text-[12px] text-[var(--text-muted)] shrink-0 transition-transform"
          style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          expand_more
        </span>
      </button>

      {expanded && (
        <div className="px-3 pb-2 pl-10">
          <div className="bg-[var(--surface-3)] rounded-md p-2 text-[10px] font-mono text-[var(--text-secondary)] relative group">
            {/* Copy button */}
            <button
              onClick={handleCopy}
              className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-[var(--surface-2)]"
              title="Copy trace entry"
            >
              <span className="material-symbols-rounded text-[12px] text-[var(--text-muted)]">
                {copied ? "check" : "content_copy"}
              </span>
            </button>

            {/* Agent info */}
            {step.agent_id && (
              <div className="mb-1">
                <span className="text-indigo-400">agent_id:</span> {step.agent_id}
                {step.parent_agent_id && (
                  <span className="ml-2 text-[var(--text-muted)]">parent: {step.parent_agent_id}</span>
                )}
              </div>
            )}

            {/* Detail */}
            {step.detail && (
              <div className="mb-1">
                <span className="text-amber-400">detail:</span>{" "}
                <span className="select-text break-words whitespace-pre-wrap">{step.detail}</span>
              </div>
            )}

            {/* Result preview */}
            {step.result_preview && (
              <div className="mt-1 pt-1 border-t border-[var(--border)]">
                <span className="text-emerald-400">result:</span>{" "}
                <span className="select-text break-words whitespace-pre-wrap">{step.result_preview}</span>
              </div>
            )}

            {/* Timestamps */}
            <div className="mt-1 pt-1 border-t border-[var(--border)] text-[var(--text-muted)]">
              {step.started_at && <span>started: {new Date(step.started_at * 1000).toISOString()}</span>}
              {step.finished_at && <span className="ml-3">finished: {new Date(step.finished_at * 1000).toISOString()}</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function TracePanel() {
  const progressSteps = useChatStore((s) => s.progressSteps);
  const artifacts = useChatStore((s) => s.artifacts);
  const activeAgents = useChatStore((s) => s.activeAgents);

  const totalSteps = progressSteps.length;
  const doneSteps = progressSteps.filter((s) => s.status === "done").length;
  const errorSteps = progressSteps.filter((s) => s.status === "error").length;
  const runningSteps = progressSteps.filter((s) => s.status === "running").length;

  if (totalSteps === 0 && artifacts.length === 0) {
    return (
      <div className="px-4 py-8 text-center">
        <span className="material-symbols-rounded text-[var(--icon-xl)] text-[var(--text-muted)] block mb-2 opacity-40">
          bug_report
        </span>
        <p className="text-[12px] text-[var(--text-muted)]">
          {funText.traceEmpty}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Summary bar */}
      <div className="px-3 py-2 border-b border-[var(--border)] flex items-center gap-3 shrink-0">
        <span className="text-[10px] font-mono text-[var(--text-muted)]">
          {totalSteps} events
        </span>
        {doneSteps > 0 && (
          <span className="text-[10px] font-mono text-emerald-400/70">{doneSteps} done</span>
        )}
        {runningSteps > 0 && (
          <span className="text-[10px] font-mono text-indigo-400">{runningSteps} running</span>
        )}
        {errorSteps > 0 && (
          <span className="text-[10px] font-mono text-rose-400">{errorSteps} errors</span>
        )}
        {artifacts.length > 0 && (
          <span className="text-[10px] font-mono text-amber-400/70">{artifacts.length} artifacts</span>
        )}
        {activeAgents.length > 0 && (
          <span className="text-[10px] font-mono text-indigo-400">{activeAgents.length} active agents</span>
        )}
      </div>

      {/* Trace entries */}
      <div className="flex-1 overflow-y-auto">
        {progressSteps.map((step, i) => (
          <TraceEntry key={step.id || i} step={step} index={i} />
        ))}
      </div>
    </div>
  );
}
