import { motion, AnimatePresence } from "framer-motion";
import { useChatStore } from "@/stores/chatStore";

/**
 * AgentParticles — Minimal activity indicator: a thin scanning line at the
 * top of the chat area while the agent is working. No emojis, no orbs.
 */
export function AgentParticles() {
  const isStreaming = useChatStore((s) => s.isStreaming);
  const progressSteps = useChatStore((s) => s.progressSteps);

  const isActive = isStreaming && progressSteps.some((s) => s.status === "running");

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="absolute inset-x-0 top-0 h-[1px] overflow-hidden pointer-events-none z-10"
        >
          <div className="absolute h-full w-1/3 bg-amber-500/40 activity-scan" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
