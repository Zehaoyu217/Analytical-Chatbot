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
  emoji: string;
  message: string;
  color: string;
  type: "thinking" | "tool" | "done" | "artifact";
}

const TOOL_TOASTS: Record<string, { emoji: string; icon: string; color: string; messages: string[] }> = {
  query_duckdb: {
    emoji: "🦆",
    icon: "database",
    color: "from-cyan-500/20 to-blue-500/10 border-cyan-500/30",
    messages: [
      "Quack! Running your query...",
      "The ducks are on it!",
      "SQL magic incoming...",
      "Diving into the data pond...",
      "SELECT * FROM brilliance...",
    ],
  },
  run_python: {
    emoji: "🐍",
    icon: "code",
    color: "from-emerald-500/20 to-green-500/10 border-emerald-500/30",
    messages: [
      "Python is computing...",
      "Snek goes brrr...",
      "import awesome_results",
      "Running the numbers...",
      "Crunching data Pythonically...",
    ],
  },
  save_artifact: {
    emoji: "💎",
    icon: "diamond",
    color: "from-violet-500/20 to-purple-500/10 border-violet-500/30",
    messages: [
      "Saving something shiny!",
      "Treasure secured!",
      "Artifact crafted!",
      "Locking in the goods...",
    ],
  },
  save_dashboard_component: {
    emoji: "📊",
    icon: "dashboard",
    color: "from-amber-500/20 to-orange-500/10 border-amber-500/30",
    messages: [
      "Dashboard piece ready!",
      "Widget deployed!",
      "Building Bloomberg 2.0...",
      "Making it look fancy...",
    ],
  },
  delegate_to_agent: {
    emoji: "🤖",
    icon: "smart_toy",
    color: "from-indigo-500/20 to-purple-500/10 border-indigo-500/30",
    messages: [
      "Calling in the specialist!",
      "Assembling the A-team...",
      "Tag team activated!",
      "Expert agent deployed...",
    ],
  },
  get_schema: {
    emoji: "🔍",
    icon: "schema",
    color: "from-teal-500/20 to-cyan-500/10 border-teal-500/30",
    messages: [
      "Inspecting the blueprint...",
      "X-raying the table...",
      "Reading the schema DNA...",
    ],
  },
  list_datasets: {
    emoji: "📋",
    icon: "list_alt",
    color: "from-sky-500/20 to-blue-500/10 border-sky-500/30",
    messages: [
      "Taking inventory...",
      "Surveying the data lake...",
      "Counting the tables...",
    ],
  },
};

const THINKING_TOASTS = {
  emoji: "🧠",
  icon: "psychology",
  color: "from-indigo-500/20 to-violet-500/10 border-indigo-500/30",
  messages: [
    "Neurons firing...",
    "Big brain mode activated!",
    "Thinking really hard...",
    "The AI is cooking...",
    "Assembling infinite wisdom...",
    "Galaxy brain engaged...",
    "Consulting the oracle...",
    "Synapses sparking...",
  ],
};

const RESPONDING_TOASTS = {
  emoji: "✍️",
  icon: "edit_note",
  color: "from-purple-500/20 to-pink-500/10 border-purple-500/30",
  messages: [
    "Writing something brilliant...",
    "Crafting the perfect response...",
    "Words are flowing...",
    "Poetry in motion...",
  ],
};

const DONE_TOASTS = {
  emoji: "🎉",
  icon: "celebration",
  color: "from-emerald-500/20 to-green-500/10 border-emerald-500/30",
  messages: [
    "All done! Nailed it!",
    "Mission accomplished!",
    "Boom! Results are in!",
    "That was satisfying!",
    "Chef's kiss!",
  ],
};

const ARTIFACT_TOASTS = {
  emoji: "✨",
  icon: "auto_awesome",
  color: "from-amber-500/20 to-yellow-500/10 border-amber-500/30",
  messages: [
    "New artifact created!",
    "Something cool just appeared!",
    "Fresh results ready!",
    "Check out this beauty!",
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
          emoji: DONE_TOASTS.emoji,
          message: pickRandom(DONE_TOASTS.messages),
          color: DONE_TOASTS.color,
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
        emoji: ARTIFACT_TOASTS.emoji,
        message: pickRandom(ARTIFACT_TOASTS.messages),
        color: ARTIFACT_TOASTS.color,
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
    <div className="fixed bottom-24 right-6 z-50 flex flex-col-reverse gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, y: 30, scale: 0.85, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, x: 80, scale: 0.9, filter: "blur(2px)" }}
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 25,
              mass: 0.8,
            }}
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl
              bg-gradient-to-r ${toast.color} border backdrop-blur-xl
              shadow-lg shadow-black/20 min-w-[240px] max-w-[340px]`}
          >
            {/* Animated emoji */}
            <motion.span
              className="text-xl shrink-0"
              initial={{ rotate: -20, scale: 0 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 15, delay: 0.1 }}
            >
              {toast.emoji}
            </motion.span>

            {/* Message */}
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium text-[var(--text-primary)] leading-snug truncate">
                {toast.message}
              </p>
            </div>

            {/* Animated icon */}
            <motion.span
              className="material-symbols-rounded text-[16px] text-[var(--text-muted)] shrink-0"
              animate={{
                rotate: toast.type === "thinking" ? [0, 10, -10, 0] : 0,
                scale: toast.type === "done" ? [1, 1.3, 1] : 1,
              }}
              transition={{
                duration: toast.type === "thinking" ? 2 : 0.5,
                repeat: toast.type === "thinking" ? Infinity : 0,
              }}
            >
              {toast.icon}
            </motion.span>

            {/* Progress bar that drains */}
            <motion.div
              className="absolute bottom-0 left-0 h-[2px] rounded-b-xl bg-white/20"
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
        emoji: config.emoji,
        message: pickRandom(config.messages),
        color: config.color,
        type: "tool",
      });
      return;
    }
  }

  // Thinking step
  if (label.includes("Thinking")) {
    addToast({
      icon: THINKING_TOASTS.icon,
      emoji: THINKING_TOASTS.emoji,
      message: pickRandom(THINKING_TOASTS.messages),
      color: THINKING_TOASTS.color,
      type: "thinking",
    });
    return;
  }

  // Responding step
  if (label.includes("Generating") || label.includes("Responding")) {
    addToast({
      icon: RESPONDING_TOASTS.icon,
      emoji: RESPONDING_TOASTS.emoji,
      message: pickRandom(RESPONDING_TOASTS.messages),
      color: RESPONDING_TOASTS.color,
      type: "thinking",
    });
    return;
  }

  // Running tools
  if (label.includes("Running tools")) {
    addToast({
      icon: "build",
      emoji: "⚡",
      message: "Tools are firing up!",
      color: "from-amber-500/20 to-orange-500/10 border-amber-500/30",
      type: "tool",
    });
  }
}
