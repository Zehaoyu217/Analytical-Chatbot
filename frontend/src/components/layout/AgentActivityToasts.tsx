import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useChatStore } from "@/stores/chatStore";
import type { ProgressStep } from "@/types";

/**
 * AgentActivityToasts — Fun floating notifications that pop up when the agent
 * starts thinking, runs tools, or completes tasks. Each toast has a tool-specific
 * icon, animation, and witty message.
 */

interface Toast {
  id: string;
  icon: string;
  message: string;
  accent: string;
  type: "thinking" | "tool" | "done" | "artifact";
}

const TOOL_TOASTS: Record<string, { icon: string; accent: string; messages: string[] }> = {
  query_duckdb: {
    icon: "database",
    accent: "text-teal-400 border-teal-500/20",
    messages: [
      "Running query...",
      "Querying data...",
      "SQL executing...",
      "Reading tables...",
    ],
  },
  run_python: {
    icon: "terminal",
    accent: "text-emerald-400 border-emerald-500/20",
    messages: [
      "Executing code...",
      "Computing...",
      "Running analysis...",
      "Processing...",
    ],
  },
  save_artifact: {
    icon: "add_chart",
    accent: "text-violet-400 border-violet-500/20",
    messages: [
      "Saving artifact...",
      "Output saved.",
      "Artifact created.",
    ],
  },
  save_dashboard_component: {
    icon: "space_dashboard",
    accent: "text-amber-400 border-amber-500/20",
    messages: [
      "Component ready.",
      "Widget saved.",
      "Dashboard updated.",
    ],
  },
  delegate_to_agent: {
    icon: "smart_toy",
    accent: "text-amber-400 border-amber-500/20",
    messages: [
      "Delegating task...",
      "Sub-agent dispatched.",
      "Specialist engaged.",
    ],
  },
  get_schema: {
    icon: "schema",
    accent: "text-sky-400 border-sky-500/20",
    messages: [
      "Reading schema...",
      "Inspecting table...",
    ],
  },
  list_datasets: {
    icon: "list_alt",
    accent: "text-sky-400 border-sky-500/20",
    messages: [
      "Listing datasets...",
      "Taking inventory...",
    ],
  },
};

const THINKING_TOASTS = {
  icon: "psychology",
  accent: "text-amber-400 border-amber-500/20",
  messages: [
    "Planning approach...",
    "Analyzing request...",
    "Thinking...",
    "Reasoning...",
  ],
};

const RESPONDING_TOASTS = {
  icon: "edit_note",
  accent: "text-amber-400 border-amber-500/20",
  messages: [
    "Composing response...",
    "Writing...",
    "Generating output...",
  ],
};

const DONE_TOASTS = {
  icon: "check_circle",
  accent: "text-emerald-400 border-emerald-500/20",
  messages: [
    "Complete.",
    "Done.",
    "Finished.",
  ],
};

const ARTIFACT_TOASTS = {
  icon: "auto_awesome",
  accent: "text-amber-400 border-amber-500/20",
  messages: [
    "Artifact created.",
    "New output ready.",
    "Results saved.",
  ],
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const TOAST_DURATION = 3000;
const MAX_TOASTS = 3;

export function AgentActivityToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const progressSteps = useChatStore((s) => s.progressSteps);
  const artifacts = useChatStore((s) => s.artifacts);
  const lastStepCountRef = useRef(0);
  const lastArtifactCountRef = useRef(0);
  const shownStepsRef = useRef<Set<string>>(new Set());

  const addToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-(MAX_TOASTS - 1)), { ...toast, id }]);

    // Auto-remove after duration
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, TOAST_DURATION);
  }, []);

  // Watch progress steps for new running/done events
  useEffect(() => {
    if (progressSteps.length <= lastStepCountRef.current) {
      lastStepCountRef.current = progressSteps.length;
      return;
    }

    // Process new steps
    for (let i = lastStepCountRef.current; i < progressSteps.length; i++) {
      const step = progressSteps[i];
      const stepKey = `${step.id}-${step.status}`;
      if (shownStepsRef.current.has(stepKey)) continue;
      shownStepsRef.current.add(stepKey);

      if (step.status === "running") {
        toastForStep(step, addToast);
      }
    }

    // Check for steps that transitioned to done (upserted)
    for (const step of progressSteps) {
      const doneKey = `${step.id}-done`;
      if (step.status === "done" && step.label === "Complete" && !shownStepsRef.current.has(doneKey)) {
        shownStepsRef.current.add(doneKey);
        addToast({
          icon: DONE_TOASTS.icon,
          message: pickRandom(DONE_TOASTS.messages),
          accent: DONE_TOASTS.accent,
          type: "done",
        });
      }
    }

    lastStepCountRef.current = progressSteps.length;
  }, [progressSteps, addToast]);

  // Watch for new artifacts
  useEffect(() => {
    if (artifacts.length > lastArtifactCountRef.current) {
      addToast({
        icon: ARTIFACT_TOASTS.icon,
        message: pickRandom(ARTIFACT_TOASTS.messages),
        accent: ARTIFACT_TOASTS.accent,
        type: "artifact",
      });
    }
    lastArtifactCountRef.current = artifacts.length;
  }, [artifacts, addToast]);

  // Reset refs when steps are cleared (new message)
  useEffect(() => {
    if (progressSteps.length === 0) {
      shownStepsRef.current.clear();
      lastStepCountRef.current = 0;
      lastArtifactCountRef.current = 0;
    }
  }, [progressSteps.length]);

  if (toasts.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Agent activity notifications"
      className="fixed bottom-20 right-5 z-50 flex flex-col-reverse gap-1.5 pointer-events-none"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className={`pointer-events-auto relative flex items-center gap-2 px-3 py-2 rounded-[var(--radius-sm)]
              bg-[var(--surface-2)] border ${toast.accent}
              shadow-[var(--shadow-md)] min-w-[200px] max-w-[280px]`}
          >
            <span className={`material-symbols-rounded text-[14px] shrink-0 ${toast.accent.split(' ')[0]}`}>
              {toast.icon}
            </span>
            <p className="text-[11px] font-mono text-[var(--text-secondary)] leading-snug truncate">
              {toast.message}
            </p>

            {/* Drain bar */}
            <motion.div
              className="absolute bottom-0 left-0 h-[1px] bg-white/10"
              initial={{ width: "100%" }}
              animate={{ width: "0%" }}
              transition={{ duration: TOAST_DURATION / 1000, ease: "linear" }}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function toastForStep(step: ProgressStep, addToast: (t: Omit<Toast, "id">) => void) {
  const label = step.label;

  // Tool-specific toasts
  if (step.type === "tool" || label in TOOL_TOASTS) {
    const config = TOOL_TOASTS[label];
    if (config) {
      addToast({
        icon: config.icon,
        message: pickRandom(config.messages),
        accent: config.accent,
        type: "tool",
      });
      return;
    }
  }

  // Thinking step
  if (label.includes("Thinking")) {
    addToast({
      icon: THINKING_TOASTS.icon,
      message: pickRandom(THINKING_TOASTS.messages),
      accent: THINKING_TOASTS.accent,
      type: "thinking",
    });
    return;
  }

  // Responding step
  if (label.includes("Generating") || label.includes("Responding")) {
    addToast({
      icon: RESPONDING_TOASTS.icon,
      message: pickRandom(RESPONDING_TOASTS.messages),
      accent: RESPONDING_TOASTS.accent,
      type: "thinking",
    });
    return;
  }

  // Running tools
  if (label.includes("Running tools")) {
    addToast({
      icon: "build",
      message: "Executing tools...",
      accent: "text-amber-400 border-amber-500/20",
      type: "tool",
    });
  }
}
