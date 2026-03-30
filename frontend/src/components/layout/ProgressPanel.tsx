import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useChatStore } from "@/stores/chatStore";
import { funText } from "@/lib/funText";
import type { ProgressStep } from "@/types";

/* ── Fun thinking verbs (rotate while running) ────────── */
const THINKING_VERBS = [
  "Pondering the universe...", "Crunching numbers like a boss...", "Consulting the data gods...",
  "Mining for golden insights...", "Connecting ALL the dots...", "Brewing a fresh analysis...",
  "Wrangling wild data...", "Doing big brain math...", "Reading the tea leaves...",
  "Assembling infinite wisdom...", "Channeling inner nerd...", "Summoning the math wizards...",
  "Juggling variables...", "Untangling the data spaghetti...", "Herding data cats...",
  "Putting on thinking cap...", "Entering the data matrix...", "Calculating at light speed...",
  "Spinning up brain cells...", "Going full galaxy brain...",
  "Running the numbers (twice)...", "Asking DuckDB nicely...", "Convincing Python to cooperate...",
  "Deploying advanced statistics...", "Thinking about thinking...", "This is fine. Data is fine.",
];

const TOOL_VERBS: Record<string, string[]> = {
  query_duckdb: [
    "Quacking through SQL...", "Asking the ducks politely...", "Querying the data pond...",
    "SQL-ing like a pro...", "SELECT-ing the good stuff...", "JOINing the party...",
    "GROUP BY... everything...", "Filtering with extreme prejudice...",
  ],
  run_python: [
    "Unleashing the snake...", "Running Pythonic magic...", "Crunching in Python...",
    "Computing away...", "import awesome_results...", "def get_answers()...",
    "Snake go brrrr...", "Numpy doing numpy things...", "pandas are eating data...",
  ],
  save_artifact: [
    "Saving treasures...", "Stashing the goods...", "Preserving findings...",
    "Framing it nicely...", "Archiving brilliance...",
  ],
  load_skill: [
    "Loading special powers...", "Activating skill module...", "Unlocking abilities...",
    "Reading the manual (actually)...", "Skill tree ++...",
  ],
  get_schema: [
    "Inspecting the blueprint...", "Reading the schema tea...", "Mapping the data DNA...",
    "What columns lurk here?...", "Surveying the terrain...",
  ],
  list_datasets: [
    "Surveying the data lake...", "Counting tables...", "Taking inventory...",
    "What data do we have?...", "Checking the warehouse...",
  ],
  save_dashboard_component: [
    "Building the dashboard...", "Painting the canvas...", "Placing the widgets...",
    "Assembling the mission control...", "Dashboard++...",
  ],
  record_finding: [
    "Logging to the brain...", "Pinning this finding...", "Filing it away...",
    "Memory updated...", "This is important, keeping it...",
  ],
};

const DONE_QUIPS = [
  "Nailed it!", "Done and dusted!", "Boom!", "Easy peasy!",
  "That was fun!", "Mission complete!", "Another one bites the dust!",
  "Ta-da!", "Chef's kiss!", "Mic drop!", "Crushed it.",
  "Analysis complete.", "Brought to you by SQL.", "The data has spoken.",
];

/* ── Terminal empty state messages ───────────────────── */
const TERMINAL_STANDBY = [
  "awaiting query...",
  "standing by...",
  "ready to analyze...",
  "idle. ask me something...",
  "systems nominal...",
  "all tools loaded...",
  "connected to DuckDB...",
  "LLM is warm and waiting...",
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
function LiveTimer({ startedAt, className }: { startedAt: number; className?: string }) {
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
    <span className={`text-[10px] font-mono tabular-nums shrink-0 ${className ?? "text-amber-400/80"}`}>
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
      className="text-[10px] text-emerald-400/70 font-mono tabular-nums shrink-0 bg-emerald-500/8 px-1.5 py-0.5 rounded-sm"
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
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.15 }}
        className="text-[10px] text-amber-400/55 italic truncate max-w-[160px]"
      >
        {text}
      </motion.span>
    </AnimatePresence>
  );
}

/* ── Tool icon mapping ───────────────────────────────── */
function getToolIcon(toolName: string): string {
  const icons: Record<string, string> = {
    query_duckdb:             "table_rows",
    run_python:               "terminal",
    save_artifact:            "add_chart",
    save_dashboard_component: "space_dashboard",
    list_datasets:            "dataset",
    get_schema:               "account_tree",
    load_skill:               "extension",
    get_artifact_content:     "description",
    update_artifact:          "edit_note",
    record_finding:           "emoji_objects",
    read_result:              "read_more",
  };
  return icons[toolName] || "manufacturing";
}

/* ── Tool color palette ──────────────────────────────── */
const TOOL_COLORS: Record<string, { bg: string; text: string; runBg: string }> = {
  query_duckdb:            { bg: "bg-teal-500/10",   text: "text-teal-400",   runBg: "bg-teal-500/15" },
  run_python:              { bg: "bg-violet-500/10",  text: "text-violet-400", runBg: "bg-violet-500/15" },
  save_artifact:           { bg: "bg-emerald-500/10", text: "text-emerald-400",runBg: "bg-emerald-500/15" },
  save_dashboard_component:{ bg: "bg-cyan-500/10",    text: "text-cyan-400",   runBg: "bg-cyan-500/15" },
  list_datasets:           { bg: "bg-sky-500/10",     text: "text-sky-400",    runBg: "bg-sky-500/15" },
  get_schema:              { bg: "bg-blue-500/10",    text: "text-blue-400",   runBg: "bg-blue-500/15" },
  load_skill:              { bg: "bg-amber-500/10",   text: "text-amber-400",  runBg: "bg-amber-500/15" },
  get_artifact_content:    { bg: "bg-slate-500/10",   text: "text-slate-400",  runBg: "bg-slate-500/15" },
  update_artifact:         { bg: "bg-slate-500/10",   text: "text-slate-400",  runBg: "bg-slate-500/15" },
  record_finding:          { bg: "bg-rose-500/10",    text: "text-rose-400",   runBg: "bg-rose-500/15" },
  read_result:             { bg: "bg-orange-500/10",  text: "text-orange-400", runBg: "bg-orange-500/15" },
};
const DEFAULT_TOOL_COLOR = { bg: "bg-amber-500/10", text: "text-amber-400", runBg: "bg-amber-500/12" };

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
    record_finding: "Record Finding",
  };
  return names[name] || name;
}

/* ── Expandable preview block (input or output) ─────── */
function PreviewBlock({
  preview,
  marker,
  markerClass,
}: {
  preview: string;
  marker: string;
  markerClass: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!preview) return null;

  const isLong = preview.length > 120;
  const display = expanded ? preview : preview.slice(0, 120) + (isLong ? "..." : "");

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
      className="mt-1"
    >
      <div
        onClick={() => isLong && setExpanded(!expanded)}
        className={`relative group/preview text-[10px] font-mono bg-[var(--surface-3)] px-2 py-1.5 pr-7 rounded-sm leading-relaxed text-left max-w-full break-words select-text border border-[var(--border)] ${isLong ? "cursor-pointer" : ""}`}
      >
        <span className={`mr-1.5 select-none ${markerClass}`}>{marker}</span>
        <span className={`text-[var(--text-secondary)] ${isLong && !expanded ? "hover:text-[var(--text-primary)]" : ""}`}>
          {display}
        </span>
        <button
          onClick={handleCopy}
          className="absolute top-1 right-1 opacity-0 group-hover/preview:opacity-100 transition-opacity p-0.5 rounded hover:bg-[var(--surface-2)]"
          title="Copy"
        >
          <span className="material-symbols-rounded text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
            {copied ? "check" : "content_copy"}
          </span>
        </button>
      </div>
    </motion.div>
  );
}

function ResultPreview({ preview }: { preview: string }) {
  return <PreviewBlock preview={preview} marker="→" markerClass="text-emerald-400/70" />;
}

function InputPreview({ preview }: { preview: string }) {
  return <PreviewBlock preview={preview} marker="←" markerClass="text-amber-400/50" />;
}

/* ── Python Code Block ───────────────────────────────── */
function PythonCodeBlock({ code, isRunning }: { code: string; isRunning: boolean }) {
  const lines = code.split("\n");
  const PREVIEW_LINES = 5;
  const isLong = lines.length > PREVIEW_LINES;
  const [expanded, setExpanded] = useState(isRunning);
  const [copied, setCopied] = useState(false);

  // Auto-collapse when run finishes
  useEffect(() => {
    if (!isRunning && isLong) setExpanded(false);
  }, [isRunning, isLong]);

  const displayCode = expanded ? code : lines.slice(0, PREVIEW_LINES).join("\n") + (isLong ? "\n…" : "");

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="mt-1.5"
    >
      <div className="rounded-sm bg-[#0b0e18] border border-violet-500/20 overflow-hidden">
        {/* Header bar */}
        <div className="flex items-center justify-between px-2 py-1 border-b border-violet-500/15 bg-violet-500/5">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400/60" />
            <span className="text-[9px] font-mono text-violet-400/70 tracking-wider">PYTHON</span>
            {isRunning && (
              <span className="text-[9px] font-mono text-amber-400/60 animate-pulse">executing…</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {isLong && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-[9px] font-mono text-violet-400/50 hover:text-violet-400 transition-colors px-1"
              >
                {expanded ? "collapse" : `+${lines.length - PREVIEW_LINES} lines`}
              </button>
            )}
            <button
              onClick={handleCopy}
              className="p-0.5 rounded hover:bg-violet-500/10 transition-colors"
              title="Copy code"
            >
              <span className="material-symbols-rounded text-[11px] text-violet-400/50 hover:text-violet-400">
                {copied ? "check" : "content_copy"}
              </span>
            </button>
          </div>
        </div>
        {/* Code */}
        <pre
          className="px-3 py-2 text-[10.5px] font-mono leading-[1.65] overflow-x-auto select-text"
          style={{ color: "rgba(180, 190, 220, 0.85)" }}
        >
          {displayCode}
        </pre>
      </div>
    </motion.div>
  );
}

/* ── Tool Step Row ───────────────────────────────────── */
function ToolRow({ step }: { step: ProgressStep }) {
  const [showInput, setShowInput] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const icon = getToolIcon(step.label);
  const hasResult = !!step.result_preview;
  const hasInput = !!step.args_preview;
  const isPython = step.label === "run_python";
  const isRunning = step.status === "running";
  const isDone = step.status === "done";
  const toolColors = TOOL_COLORS[step.label] || DEFAULT_TOOL_COLOR;

  // Python code block: auto-visible while running, toggled when done
  const showCode = isPython && (isRunning || showInput);

  const pillBase = "text-[10px] font-mono px-1.5 py-[1px] rounded-sm border transition-all duration-150";
  const pillActive = `${toolColors.text} ${toolColors.bg} border-transparent`;
  const pillInactive = "text-[var(--text-muted)] bg-transparent border-[var(--border)] hover:text-[var(--text-secondary)] hover:border-[var(--border-strong)]";

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, x: -4 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.12 }}
        className="flex items-start gap-1.5 py-[3px]"
      >
        {/* Tool icon */}
        <div
          className={`relative w-[18px] h-[18px] rounded-sm flex items-center justify-center shrink-0 mt-0.5 ${
            isDone
              ? toolColors.bg
              : isRunning
                ? `${toolColors.runBg} step-running-glow`
                : step.status === "error"
                  ? "bg-rose-500/10"
                  : "bg-[var(--surface-3)]"
          }`}
        >
          <span
            className={`material-symbols-rounded text-[11px] leading-none ${
              isDone
                ? toolColors.text
                : isRunning
                  ? toolColors.text
                  : step.status === "error"
                    ? "text-rose-400"
                    : "text-[var(--text-muted)]"
            }`}
          >
            {step.status === "error" ? "error" : icon}
          </span>
          {/* Status dot: tiny indicator in bottom-right corner */}
          {isDone && (
            <span className="absolute -bottom-[2px] -right-[2px] w-[5px] h-[5px] rounded-full bg-emerald-400 ring-1 ring-[var(--surface-1)]" />
          )}
          {isRunning && (
            <span className="absolute -bottom-[2px] -right-[2px] w-[5px] h-[5px] rounded-full bg-amber-400 animate-pulse ring-1 ring-[var(--surface-1)]" />
          )}
        </div>

        {/* Tool name + timing + input/output toggles */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <span
              className={`text-[11px] font-medium leading-none ${
                isDone
                  ? "text-[var(--text-secondary)]"
                  : isRunning
                    ? "text-[var(--text-primary)]"
                    : step.status === "error"
                      ? "text-rose-400"
                      : "text-[var(--text-muted)]"
              }`}
            >
              {friendlyToolName(step.label)}
            </span>

            {isRunning && step.started_at && (
              <LiveTimer startedAt={step.started_at} />
            )}

            {isDone && step.started_at && step.finished_at && (
              <ElapsedBadge startedAt={step.started_at} finishedAt={step.finished_at} />
            )}

            {isRunning && (
              <RunningStatus label={step.label} type="tool" />
            )}

            {/* Input pill — hidden while running (auto-shown), shown when done */}
            {hasInput && isDone && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowInput(!showInput); }}
                className={`${pillBase} ${showInput ? pillActive : pillInactive}`}
              >
                input
              </button>
            )}

            {/* Output pill */}
            {hasResult && isDone && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowResult(!showResult); }}
                className={`${pillBase} ${showResult ? pillActive : pillInactive}`}
              >
                output
              </button>
            )}
          </div>

          {/* Args preview inline — only for non-python while running */}
          {hasInput && isRunning && !isPython && (
            <p className="text-[10px] font-mono truncate mt-0.5 text-amber-400/50">
              {step.args_preview}
            </p>
          )}
        </div>
      </motion.div>

      {/* Error detail */}
      {step.status === "error" && step.detail && (
        <p className="text-[10px] text-rose-400/70 ml-[22px] truncate">
          {step.detail}
        </p>
      )}

      {/* Python code block */}
      <AnimatePresence>
        {showCode && step.args_preview && (
          <motion.div
            key="python-code"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden ml-[22px]"
          >
            <PythonCodeBlock code={step.args_preview} isRunning={isRunning} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Non-python input preview */}
      <AnimatePresence>
        {showInput && !isPython && step.args_preview && (
          <div className="ml-[22px]">
            <InputPreview preview={step.args_preview} />
          </div>
        )}
      </AnimatePresence>

      {/* Output/result preview */}
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
    if (step.label === "Thinking..." || step.label === "Generating response...") {
      currentRound = { thinking: step, tools: [] };
      rounds.push(currentRound);
    } else if (step.label === "Running tools..." || step.label === "Complete") {
      continue;
    } else if (step.type === "tool" && currentRound) {
      currentRound.tools.push(step);
    } else {
      ungrouped.push(step);
    }
  }

  // Filter noise: skip rounds that are done, have no tools, and no decision.
  // "Generating response..." rounds fall here — the CommandHeader already shows DONE.
  const filtered = rounds.filter((r) => {
    if (r.tools.length > 0) return true; // has work to show
    if (r.thinking.status !== "done") return true; // still running (show it)
    if (r.thinking.decision) return true; // meaningful decision reached without tools
    return false; // empty completed marker — skip
  });

  return { rounds: filtered, ungrouped };
}

/* ── Round View ──────────────────────────────────────── */
function RoundView({ round, roundIndex, totalRounds }: { round: Round; roundIndex: number; totalRounds: number }) {
  const [collapsed, setCollapsed] = useState(false);
  const thinking = round.thinking;
  const isRunning = thinking.status === "running";
  const isDone = thinking.status === "done";
  const hasTools = round.tools.length > 0;

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

  const roundNum = totalRounds > 1 ? `${roundIndex + 1}` : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className="mb-1"
    >
      <div
        className={`flex items-center gap-2 py-[5px] ${isDone && hasTools ? "cursor-pointer" : ""} rounded-sm -mx-1 px-1 transition-colors hover:bg-[rgba(255,255,255,0.015)]`}
        onClick={() => isDone && hasTools && setCollapsed(!collapsed)}
      >
        {/* Round indicator */}
        <div
          className={`relative z-10 flex items-center justify-center shrink-0 w-[22px] h-[22px] rounded-sm transition-all duration-300 ${
            isDone
              ? "bg-emerald-500/10 ring-1 ring-emerald-500/20"
              : isRunning
                ? "bg-amber-500/12 ring-1 ring-amber-500/30 step-running-glow"
                : "bg-rose-500/10 ring-1 ring-rose-500/20"
          }`}
        >
          {roundNum && (
            <span className={`text-[10px] font-bold leading-none font-mono ${
              isDone ? "text-emerald-400" : isRunning ? "text-amber-400" : "text-rose-400"
            }`}>
              {roundNum}
            </span>
          )}
          {!roundNum && (
            <span className={`material-symbols-rounded text-[13px] leading-none ${
              isDone ? "text-emerald-400" : isRunning ? "text-amber-400" : "text-rose-400"
            }`}>
              {isDone ? "task_alt" : isRunning ? "psychology" : "error"}
            </span>
          )}
        </div>

        {/* Header content */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
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

          {isDone && collapsed && hasTools && (
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5 font-mono">
              {round.tools.length} call{round.tools.length > 1 ? "s" : ""} — expand
            </p>
          )}
        </div>

        {isDone && hasTools && (
          <span
            className="material-symbols-rounded text-[14px] text-[var(--text-muted)] shrink-0 transition-transform duration-150"
            style={{ transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)" }}
          >
            expand_more
          </span>
        )}
      </div>

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

/* ── Command Header — replaces TotalTimerHeader ───────── */
function CommandHeader({ steps }: { steps: ProgressStep[] }) {
  const isRunning = steps.some((s) => s.status === "running");
  const allDone = steps.length > 0 && steps.every((s) => s.status === "done" || s.status === "error");
  const toolSteps = steps.filter((s) => s.type === "tool");
  const doneTools = toolSteps.filter((s) => s.status === "done");
  const errorCount = steps.filter((s) => s.status === "error").length;

  const timestamps = steps.map((s) => s.started_at).filter(Boolean) as number[];
  const earliest = timestamps.length > 0 ? Math.min(...timestamps) : null;
  const finishTimes = steps.map((s) => s.finished_at).filter(Boolean) as number[];
  const latest = finishTimes.length > 0 ? Math.max(...finishTimes) : null;

  const quipRef = useRef(DONE_QUIPS[Math.floor(Math.random() * DONE_QUIPS.length)]);
  useEffect(() => {
    if (allDone) quipRef.current = DONE_QUIPS[Math.floor(Math.random() * DONE_QUIPS.length)];
  }, [allDone]);

  return (
    <div className="mx-2.5 mb-2 rounded-[var(--radius-sm)] overflow-hidden border border-[var(--border-strong)]">
      {/* Main status row */}
      <div className="flex items-center justify-between px-2.5 py-1.5 bg-[var(--surface-3)]">
        {/* Left: status indicator + label */}
        <div className="flex items-center gap-2">
          {isRunning ? (
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
              </span>
              <span className="text-[10px] font-mono font-bold text-amber-400 tracking-[0.12em]">LIVE</span>
            </div>
          ) : allDone ? (
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span className="text-[10px] font-mono font-bold text-emerald-400 tracking-[0.12em]">DONE</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[var(--text-muted)] opacity-50" />
              <span className="text-[10px] font-mono text-[var(--text-muted)] tracking-[0.12em]">IDLE</span>
            </div>
          )}

          <span className="text-[var(--border-strong)] opacity-60">·</span>

          <span className="text-[10px] font-mono text-[var(--text-secondary)]">
            {isRunning ? "agent working" : allDone ? quipRef.current : "ready"}
          </span>
        </div>

        {/* Right: metrics */}
        <div className="flex items-center gap-3">
          {/* Tool call counter */}
          {toolSteps.length > 0 && (
            <div className="flex items-center gap-1">
              <span className="material-symbols-rounded text-[11px] text-[var(--text-muted)]">build</span>
              <span className="text-[10px] font-mono tabular-nums text-[var(--text-secondary)]">
                <motion.span
                  key={doneTools.length}
                  initial={{ scale: 1.3, color: "#d4a017" }}
                  animate={{ scale: 1, color: "#8494ad" }}
                  transition={{ duration: 0.3 }}
                >
                  {doneTools.length}
                </motion.span>
                <span className="text-[var(--text-muted)]">/{toolSteps.length}</span>
              </span>
            </div>
          )}


          {/* Total elapsed */}
          {isRunning && earliest && (
            <div className="flex items-center gap-1 bg-amber-500/8 px-1.5 py-0.5 rounded-sm border border-amber-500/20">
              <span className="material-symbols-rounded text-[10px] text-amber-400">timer</span>
              <LiveTimer startedAt={earliest} className="text-amber-400" />
            </div>
          )}
          {allDone && earliest && latest && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-1 bg-emerald-500/8 px-1.5 py-0.5 rounded-sm border border-emerald-500/20"
            >
              <span className="material-symbols-rounded text-[10px] text-emerald-400">check</span>
              <ElapsedBadge startedAt={earliest} finishedAt={latest} />
            </motion.div>
          )}

          {errorCount > 0 && (
            <span className="text-[9px] font-mono text-rose-400 bg-rose-500/8 px-1.5 py-0.5 rounded-sm border border-rose-500/20">
              {errorCount} err
            </span>
          )}
        </div>
      </div>

      {/* Activity scanning bar */}
      <div className="h-[2px] bg-[var(--surface-2)] relative overflow-hidden">
        {isRunning && <div className="absolute h-full bg-amber-500/60 activity-scan" />}
        {allDone && <div className="h-full w-full bg-emerald-500/25" />}
      </div>
    </div>
  );
}

/* ── Terminal Empty State ────────────────────────────── */
function TerminalEmptyState() {
  const message = useRotatingText(TERMINAL_STANDBY, 3200);
  const [blink, setBlink] = useState(true);

  useEffect(() => {
    const t = setInterval(() => setBlink((b) => !b), 500);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="px-4 py-5">
      <div className="font-mono text-[11px] leading-[1.8] space-y-0">
        <div className="text-[var(--text-muted)]">
          <span className="text-emerald-400/50">$</span>{" "}
          <span className="text-[var(--text-muted)]">analytical-agent --ready</span>
        </div>
        <div className="text-[var(--text-muted)] opacity-70">→ tools loaded · context ready</div>
        <div className="text-[var(--text-muted)] opacity-70">→ duckdb connected · llm warm</div>
        <div className="mt-1">
          <span className="text-amber-400/40">$</span>{" "}
          <span className="text-amber-400/60">{message}</span>
          <span className={`text-amber-400 ${blink ? "opacity-100" : "opacity-0"}`}>▌</span>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-[var(--text-muted)] opacity-50 font-mono">
        {funText.progressEmpty}
      </p>
    </div>
  );
}

/* ── Main ProgressPanel ───────────────────────────────── */
export function ProgressPanel() {
  const progressSteps = useChatStore((s) => s.progressSteps);

  if (progressSteps.length === 0) {
    return <TerminalEmptyState />;
  }

  const { rounds } = groupIntoRounds(progressSteps);

  return (
    <div className="py-2">
      {/* Command header with live stats */}
      <CommandHeader steps={progressSteps} />

      {/* Rounds timeline */}
      <div className="relative pl-7 pr-3">
        {/* Vertical timeline line */}
        <div className="absolute left-[20px] top-0 bottom-0 w-px bg-gradient-to-b from-amber-500/20 via-[var(--border)] to-transparent" />

        {rounds.map((round, i) => (
          <RoundView key={round.thinking.id || i} round={round} roundIndex={i} totalRounds={rounds.length} />
        ))}
      </div>
    </div>
  );
}
