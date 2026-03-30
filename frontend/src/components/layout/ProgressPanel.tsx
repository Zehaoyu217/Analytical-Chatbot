import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useChatStore } from "@/stores/chatStore";
import { funText } from "@/lib/funText";
import type { ProgressStep, ThinkingEvent } from "@/types";

/* ── Fun thinking verbs (rotate while running) ────────── */
const THINKING_VERBS = [
  "Pondering the universe...", "Crunching numbers like a boss...", "Consulting the data gods...",
  "Mining for golden insights...", "Connecting ALL the dots...", "Brewing a fresh analysis...",
  "Wrangling wild data...", "Doing big brain math...", "Reading the tea leaves...",
  "Assembling infinite wisdom...", "Channeling inner nerd...", "Summoning the math wizards...",
  "Juggling variables...", "Untangling the data spaghetti...", "Herding data cats...",
  "Putting on thinking cap...", "Entering the data matrix...", "Calculating at light speed...",
  "Spinning up brain cells...", "Going full galaxy brain...",
];

const TOOL_VERBS: Record<string, string[]> = {
  query_duckdb: [
    "Quacking through SQL...", "Asking the ducks politely...", "Querying the data pond...",
    "SQL-ing like a pro...", "SELECT-ing the good stuff...", "JOINing the party...",
  ],
  run_python: [
    "Unleashing the snake...", "Running Pythonic magic...", "Crunching in Python...",
    "Computing away...", "import awesome_results...", "def get_answers()...",
  ],
  save_artifact: [
    "Saving treasures...", "Stashing the goods...", "Preserving findings...",
  ],
  load_skill: [
    "Loading special powers...", "Activating skill module...", "Unlocking abilities...",
  ],
  get_schema: [
    "Inspecting the blueprint...", "Reading the schema tea...", "Mapping the data DNA...",
  ],
  list_datasets: [
    "Surveying the data lake...", "Counting tables...", "Taking inventory...",
  ],
  save_dashboard_component: [
    "Building the dashboard...", "Painting the canvas...", "Placing the widgets...",
  ],
};

const DONE_QUIPS = [
  "Nailed it!", "Done and dusted!", "Boom!", "Easy peasy!",
  "That was fun!", "Mission complete!", "Another one bites the dust!",
  "Ta-da!", "Chef's kiss!", "Mic drop!",
];

function useRotatingText(texts: string[], intervalMs = 2500): string {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % texts.length);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [texts, intervalMs]);
  return texts[index];
}

/* ── Live ticking timer ──────────────────────────────── */
function LiveTimer({ startedAt }: { startedAt: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const tick = () => setElapsed(Date.now() / 1000 - startedAt);
    tick();
    const timer = setInterval(tick, 73);
    return () => clearInterval(timer);
  }, [startedAt]);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  return (
    <span className="text-[10px] font-mono tabular-nums text-indigo-400/80 shrink-0">
      {mins > 0 ? `${mins}:${secs.toFixed(1).padStart(4, "0")}` : `${secs.toFixed(1)}s`}
    </span>
  );
}

/* ── Elapsed badge (done state) ──────────────────────── */
function ElapsedBadge({ startedAt, finishedAt }: { startedAt: number; finishedAt: number }) {
  const s = finishedAt - startedAt;
  const display = s < 1 ? `${Math.round(s * 1000)}ms` : s < 60 ? `${s.toFixed(1)}s` : `${Math.floor(s / 60)}m ${(s % 60).toFixed(0)}s`;

  return (
    <motion.span
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="text-[9px] text-emerald-400/70 font-mono tabular-nums shrink-0 bg-emerald-500/8 px-1.5 py-0.5 rounded-full"
    >
      {display}
    </motion.span>
  );
}

/* ── Fun Running Status ───────────────────────────────── */
function RunningStatus({ label, type }: { label: string; type?: string }) {
  let verbs = THINKING_VERBS;
  if (type === "tool" && TOOL_VERBS[label]) {
    verbs = TOOL_VERBS[label];
  }
  const text = useRotatingText(verbs, 1600);

  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={text}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -5 }}
        transition={{ duration: 0.15 }}
        className="text-[10px] text-indigo-300/70 italic truncate max-w-[160px]"
      >
        {text}
      </motion.span>
    </AnimatePresence>
  );
}

/* ── Tool icon mapping ───────────────────────────────── */
function getToolIcon(toolName: string): string {
  const icons: Record<string, string> = {
    query_duckdb: "database",
    run_python: "code",
    save_artifact: "save",
    save_dashboard_component: "dashboard",
    list_datasets: "list",
    get_schema: "schema",
    load_skill: "auto_stories",
    get_artifact_content: "article",
    update_artifact: "edit",
  };
  return icons[toolName] || "build";
}

/* ── Friendly tool name ──────────────────────────────── */
function friendlyToolName(name: string): string {
  const names: Record<string, string> = {
    query_duckdb: "SQL Query",
    run_python: "Python",
    save_artifact: "Save Artifact",
    save_dashboard_component: "Dashboard",
    list_datasets: "List Data",
    get_schema: "Schema",
    load_skill: "Load Skill",
    get_artifact_content: "Read Artifact",
    update_artifact: "Update Artifact",
  };
  return names[name] || name;
}

/* ── Result Preview (expandable + copyable) ──────────── */
function ResultPreview({ preview }: { preview: string }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!preview) return null;

  const isLong = preview.length > 80;
  const display = expanded ? preview : preview.slice(0, 80) + (isLong ? "..." : "");

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(preview);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="mt-0.5"
    >
      <div
        onClick={() => isLong && setExpanded(!expanded)}
        className={`relative group/preview text-[10px] font-mono text-[var(--text-muted)] bg-[var(--surface-3)] px-2 py-1 pr-7 rounded-md leading-tight text-left max-w-full break-words select-text ${isLong ? "cursor-pointer hover:text-[var(--text-secondary)]" : ""}`}
      >
        <span className="text-emerald-400/60 mr-1">&rarr;</span>
        {display}
        <button
          onClick={handleCopy}
          className="absolute top-0.5 right-1 opacity-0 group-hover/preview:opacity-100 transition-opacity p-0.5 rounded hover:bg-[var(--surface-2)]"
          title="Copy result"
        >
          <span className="material-symbols-rounded text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
            {copied ? "check" : "content_copy"}
          </span>
        </button>
      </div>
    </motion.div>
  );
}

/* ── Tool Step Row (child of a round) ────────────────── */
function ToolRow({ step }: { step: ProgressStep }) {
  const [showResult, setShowResult] = useState(false);
  const icon = getToolIcon(step.label);
  const hasResult = !!step.result_preview;

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, x: -4 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.12 }}
        className="flex items-center gap-1.5 py-[3px] group"
      >
        {/* Tool icon */}
        <div
          className={`w-[18px] h-[18px] rounded flex items-center justify-center shrink-0 ${
            step.status === "done"
              ? "bg-emerald-500/10"
              : step.status === "running"
                ? "bg-indigo-500/15 step-running-glow"
                : step.status === "error"
                  ? "bg-rose-500/10"
                  : "bg-[var(--surface-3)]"
          }`}
        >
          <span
            className={`material-symbols-rounded text-[11px] leading-none ${
              step.status === "done"
                ? "text-emerald-400"
                : step.status === "running"
                  ? "text-indigo-400"
                  : step.status === "error"
                    ? "text-rose-400"
                    : "text-[var(--text-muted)]"
            }`}
          >
            {step.status === "done" ? "check" : step.status === "error" ? "error" : icon}
          </span>
        </div>

        {/* Tool name + detail */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className={`text-[11px] font-medium leading-none ${
                step.status === "done"
                  ? "text-[var(--text-secondary)]"
                  : step.status === "running"
                    ? "text-[var(--text-primary)]"
                    : step.status === "error"
                      ? "text-rose-400"
                      : "text-[var(--text-muted)]"
              }`}
            >
              {friendlyToolName(step.label)}
            </span>

            {/* Args preview as muted detail */}
            {step.detail && step.status === "running" && (
              <span className="text-[10px] font-mono text-[var(--text-muted)] truncate max-w-[140px]">
                {step.detail}
              </span>
            )}

            {step.status === "running" && step.started_at && (
              <LiveTimer startedAt={step.started_at} />
            )}

            {step.status === "done" && step.started_at && step.finished_at && (
              <ElapsedBadge startedAt={step.started_at} finishedAt={step.finished_at} />
            )}

            {step.status === "running" && (
              <RunningStatus label={step.label} type="tool" />
            )}
          </div>

          {/* Args preview for done tools (e.g., SQL query, code comment) */}
          {step.detail && step.status === "done" && step.label !== "run_python" && (
            <p className="text-[9px] font-mono text-[var(--text-muted)] truncate mt-0.5 opacity-60">
              {step.detail}
            </p>
          )}
        </div>

        {/* Result preview toggle */}
        {hasResult && step.status === "done" && (
          <button
            onClick={(e) => { e.stopPropagation(); setShowResult(!showResult); }}
            className={`w-[16px] h-[16px] rounded flex items-center justify-center shrink-0 transition-all duration-150
              ${showResult
                ? "opacity-100 bg-indigo-500/10"
                : "opacity-0 group-hover:opacity-100 hover:bg-[rgba(255,255,255,0.05)]"
              }`}
            title={showResult ? "Hide result" : "Show result"}
          >
            <span className={`material-symbols-rounded text-[10px] leading-none ${showResult ? "text-indigo-400" : "text-[var(--text-muted)]"}`}>
              {showResult ? "visibility_off" : "visibility"}
            </span>
          </button>
        )}
      </motion.div>

      {/* Error detail */}
      {step.status === "error" && step.detail && (
        <p className="text-[9px] text-rose-400/70 ml-[22px] truncate">
          {step.detail}
        </p>
      )}

      {/* Result preview */}
      <AnimatePresence>
        {showResult && step.result_preview && (
          <div className="ml-[22px]">
            <ResultPreview preview={step.result_preview} />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Round grouping logic ────────────────────────────── */
interface Round {
  thinking: ProgressStep;
  tools: ProgressStep[];
}

function groupIntoRounds(steps: ProgressStep[]): { rounds: Round[]; ungrouped: ProgressStep[] } {
  const rounds: Round[] = [];
  const ungrouped: ProgressStep[] = [];
  let currentRound: Round | null = null;

  for (const step of steps) {
    // "Thinking..." or "Generating response..." steps start a new round
    if (step.label === "Thinking..." || step.label === "Generating response...") {
      currentRound = { thinking: step, tools: [] };
      rounds.push(currentRound);
    } else if (step.label === "Running tools...") {
      // Skip the "Running tools..." wrapper — tools are shown directly
      continue;
    } else if (step.type === "tool" && currentRound) {
      currentRound.tools.push(step);
    } else if (step.label === "Complete") {
      // Skip the final "Complete" marker
      continue;
    } else {
      ungrouped.push(step);
    }
  }

  return { rounds, ungrouped };
}

/* ── Round View (thinking header + tool children) ────── */
function RoundView({ round, roundIndex, totalRounds }: { round: Round; roundIndex: number; totalRounds: number }) {
  const [collapsed, setCollapsed] = useState(false);
  const thinking = round.thinking;
  const isRunning = thinking.status === "running";
  const isDone = thinking.status === "done";
  const hasTools = round.tools.length > 0;

  // Determine the round header label
  let headerLabel: string;
  if (isRunning) {
    headerLabel = "Thinking...";
  } else if (thinking.decision) {
    headerLabel = thinking.decision;
  } else if (thinking.detail && thinking.detail !== "") {
    headerLabel = thinking.detail;
  } else {
    headerLabel = "Generating response";
  }

  // Round number badge
  const roundNum = totalRounds > 1 ? `${roundIndex + 1}` : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className="mb-1"
    >
      {/* Round header (thinking) */}
      <div
        className={`flex items-center gap-2 py-[5px] ${isDone && hasTools ? "cursor-pointer" : ""} rounded-md -mx-1 px-1 transition-colors hover:bg-[rgba(255,255,255,0.015)]`}
        onClick={() => isDone && hasTools && setCollapsed(!collapsed)}
      >
        {/* Round indicator dot */}
        <div
          className={`relative z-10 flex items-center justify-center shrink-0 w-[22px] h-[22px] rounded-full transition-all duration-300 ${
            isDone
              ? "bg-emerald-500/12 ring-1 ring-emerald-500/20"
              : isRunning
                ? "bg-indigo-500/15 ring-1 ring-indigo-500/35 step-running-glow"
                : "bg-rose-500/12 ring-1 ring-rose-500/20"
          }`}
        >
          {roundNum && (
            <span className={`text-[10px] font-bold leading-none ${
              isDone ? "text-emerald-400" : isRunning ? "text-indigo-400" : "text-rose-400"
            }`}>
              {roundNum}
            </span>
          )}
          {!roundNum && (
            <span className={`material-symbols-rounded text-[13px] leading-none ${
              isDone ? "text-emerald-400" : isRunning ? "text-indigo-400" : "text-rose-400"
            }`}>
              {isDone ? "check_circle" : isRunning ? "neurology" : "error"}
            </span>
          )}
        </div>

        {/* Header content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className={`text-[12px] font-semibold leading-none truncate ${
              isDone ? "text-[var(--text-secondary)]" : isRunning ? "text-[var(--text-primary)]" : "text-rose-400"
            }`}>
              {headerLabel}
            </span>

            {isRunning && thinking.started_at && (
              <LiveTimer startedAt={thinking.started_at} />
            )}

            {isDone && thinking.started_at && thinking.finished_at && (
              <ElapsedBadge startedAt={thinking.started_at} finishedAt={thinking.finished_at} />
            )}

            {isRunning && (
              <RunningStatus label="Thinking..." type="node" />
            )}
          </div>

          {/* Tool count summary when collapsed */}
          {isDone && collapsed && hasTools && (
            <p className="text-[9px] text-[var(--text-muted)] mt-0.5">
              {round.tools.length} tool{round.tools.length > 1 ? "s" : ""} — click to expand
            </p>
          )}
        </div>

        {/* Collapse chevron */}
        {isDone && hasTools && (
          <span
            className="material-symbols-rounded text-[14px] text-[var(--text-muted)] shrink-0 transition-transform duration-150"
            style={{ transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)" }}
          >
            expand_more
          </span>
        )}
      </div>

      {/* Tool children */}
      <AnimatePresence>
        {!collapsed && hasTools && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden ml-[10px] pl-3 border-l border-[var(--border)]"
          >
            {round.tools.map((tool, i) => (
              <ToolRow key={tool.id || i} step={tool} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── Total Timer Header ──────────────────────────────── */
function TotalTimerHeader({ steps }: { steps: ProgressStep[] }) {
  const hasRunning = steps.some((s) => s.status === "running");
  const allDone = steps.length > 0 && steps.every((s) => s.status === "done" || s.status === "error");
  const doneCount = steps.filter((s) => s.status === "done").length;
  const errorCount = steps.filter((s) => s.status === "error").length;

  const timestamps = steps.map((s) => s.started_at).filter(Boolean) as number[];
  const earliestStart = timestamps.length > 0 ? Math.min(...timestamps) : null;
  const finishTimes = steps.map((s) => s.finished_at).filter(Boolean) as number[];
  const latestFinish = finishTimes.length > 0 ? Math.max(...finishTimes) : null;

  const quipRef = useRef(DONE_QUIPS[Math.floor(Math.random() * DONE_QUIPS.length)]);
  useEffect(() => {
    if (allDone) {
      quipRef.current = DONE_QUIPS[Math.floor(Math.random() * DONE_QUIPS.length)];
    }
  }, [allDone]);

  return (
    <div className="mx-3 mb-2 px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {hasRunning ? (
            <div className="relative">
              <span className="material-symbols-rounded text-[var(--icon-md)] text-indigo-400">
                hourglass_top
              </span>
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
            </div>
          ) : allDone ? (
            <motion.span
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 15 }}
              className="material-symbols-rounded text-[var(--icon-md)] text-emerald-400"
            >
              task_alt
            </motion.span>
          ) : (
            <span className="material-symbols-rounded text-[var(--icon-md)] text-[var(--text-muted)]">
              pending
            </span>
          )}

          <span className="text-[11px] font-semibold text-[var(--text-primary)]">
            {hasRunning ? "Working..." : allDone ? quipRef.current : "Ready"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            {doneCount > 0 && (
              <span className="text-[9px] font-mono text-emerald-400/70 bg-emerald-500/8 px-1.5 py-0.5 rounded-full">
                {doneCount} done
              </span>
            )}
            {errorCount > 0 && (
              <span className="text-[9px] font-mono text-rose-400/70 bg-rose-500/8 px-1.5 py-0.5 rounded-full">
                {errorCount} err
              </span>
            )}
          </div>

          {hasRunning && earliestStart && (
            <div className="flex items-center gap-1 bg-indigo-500/10 px-2 py-0.5 rounded-full">
              <span className="material-symbols-rounded text-[10px] text-indigo-400">timer</span>
              <LiveTimer startedAt={earliestStart} />
            </div>
          )}
          {allDone && earliestStart && latestFinish && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-full"
            >
              <span className="material-symbols-rounded text-[10px] text-emerald-400">check</span>
              <ElapsedBadge startedAt={earliestStart} finishedAt={latestFinish} />
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Thinking / Planning Section (live-updating todo list) ─ */
function ThinkingSection() {
  const thinkingSteps = useChatStore((s) => s.thinkingSteps);

  if (thinkingSteps.length === 0) return null;

  return (
    <div className="mx-3 mb-2 space-y-1.5">
      <AnimatePresence>
        {thinkingSteps.map((step, i) => (
          <motion.div
            key={`thinking-${i}`}
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            {(step.kind === "plan" || step.kind === "todo_update") && step.todoItems && (
              <div className="rounded-lg bg-gradient-to-r from-amber-500/8 to-orange-500/5 border border-amber-500/20 overflow-hidden">
                {/* Header with progress badge */}
                <div className="flex items-center gap-2 px-3 py-1.5 border-b border-amber-500/10">
                  <span className="material-symbols-rounded text-[13px] text-amber-400">
                    checklist
                  </span>
                  <span className="text-[11px] font-semibold text-amber-300 flex-1">
                    {step.label}
                  </span>
                  {/* Progress fraction badge */}
                  {(() => {
                    const done = step.todoItems!.filter((t) => t.status === "done").length;
                    const total = step.todoItems!.length;
                    return (
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full ${
                        done === total
                          ? "text-emerald-400/90 bg-emerald-500/12"
                          : "text-amber-400/70 bg-amber-500/10"
                      }`}>
                        {done}/{total}
                      </span>
                    );
                  })()}
                </div>
                {/* Todo items with status indicators */}
                <div className="px-3 py-2 space-y-1">
                  {step.todoItems!.map((item, j) => (
                    <motion.div
                      key={j}
                      className="flex items-start gap-2 text-[10px]"
                      animate={item.status === "done" ? { opacity: 0.7 } : { opacity: 1 }}
                      transition={{ duration: 0.3 }}
                    >
                      {/* Status icon */}
                      {item.status === "done" ? (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 400, damping: 15 }}
                          className="material-symbols-rounded text-[13px] text-emerald-400 mt-px shrink-0"
                        >
                          check_circle
                        </motion.span>
                      ) : item.status === "running" ? (
                        <span className="material-symbols-rounded text-[13px] text-indigo-400 mt-px shrink-0 animate-pulse">
                          radio_button_checked
                        </span>
                      ) : (
                        <span className="material-symbols-rounded text-[13px] text-[var(--text-muted)] mt-px shrink-0 opacity-40">
                          radio_button_unchecked
                        </span>
                      )}
                      {/* Item text */}
                      <span className={`leading-tight ${
                        item.status === "done"
                          ? "text-[var(--text-muted)] line-through"
                          : item.status === "running"
                            ? "text-[var(--text-primary)] font-medium"
                            : "text-[var(--text-secondary)]"
                      }`}>
                        {item.text}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Legacy fallback: flat items (no todoItems) */}
            {step.kind === "plan" && !step.todoItems && step.items && (
              <div className="rounded-lg bg-gradient-to-r from-amber-500/8 to-orange-500/5 border border-amber-500/20 overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-1.5 border-b border-amber-500/10">
                  <span className="material-symbols-rounded text-[13px] text-amber-400">
                    checklist
                  </span>
                  <span className="text-[11px] font-semibold text-amber-300">
                    {step.label}
                  </span>
                </div>
                <div className="px-3 py-2 space-y-1">
                  {step.items.map((item, j) => (
                    <div key={j} className="flex items-start gap-2 text-[10px]">
                      <span className="text-amber-400/60 mt-px shrink-0">{j + 1}.</span>
                      <span className="text-[var(--text-secondary)]">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {step.kind === "delegation" && (
              <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-gradient-to-r from-purple-500/8 to-indigo-500/5 border border-purple-500/20">
                <span className="material-symbols-rounded text-[13px] text-purple-400">
                  fork_right
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] font-semibold text-purple-300">
                    {step.label}
                  </span>
                  {step.task && (
                    <p className="text-[10px] text-[var(--text-muted)] truncate mt-0.5">
                      {step.task}
                    </p>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ── Main ProgressPanel ───────────────────────────────── */
export function ProgressPanel() {
  const progressSteps = useChatStore((s) => s.progressSteps);

  if (progressSteps.length === 0) {
    return (
      <div className="px-4 py-8 text-center">
        <span className="material-symbols-rounded text-[var(--icon-xl)] text-[var(--text-muted)] block mb-2 opacity-40">
          timeline
        </span>
        <p className="text-[12px] text-[var(--text-muted)]">
          {funText.progressEmpty}
        </p>
      </div>
    );
  }

  const { rounds } = groupIntoRounds(progressSteps);

  return (
    <div className="py-2">
      {/* Total timer header */}
      <TotalTimerHeader steps={progressSteps} />

      {/* Thinking/planning (todo list) */}
      <ThinkingSection />

      {/* Rounds timeline */}
      <div className="relative pl-7 pr-3">
        {/* Vertical line */}
        <div className="absolute left-[20px] top-0 bottom-0 w-px bg-gradient-to-b from-indigo-500/30 via-[var(--border)] to-transparent" />

        {rounds.map((round, i) => (
          <RoundView key={round.thinking.id || i} round={round} roundIndex={i} totalRounds={rounds.length} />
        ))}
      </div>
    </div>
  );
}
