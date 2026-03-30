import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useChatStore } from "@/stores/chatStore";

/**
 * AgentParticles — Ambient floating particles that appear over the chat area
 * while the agent is actively working. Subtle, non-intrusive, but makes the
 * UI feel alive.
 */

const PARTICLE_EMOJIS = ["✨", "🔮", "💫", "⚡", "🧬", "🎯", "💡", "🔥"];
const PARTICLE_COUNT = 8;

interface Particle {
  id: number;
  emoji: string;
  x: number; // % from left
  delay: number;
  duration: number;
  size: number;
}

export function AgentParticles() {
  const isStreaming = useChatStore((s) => s.isStreaming);
  const progressSteps = useChatStore((s) => s.progressSteps);

  const isActive = isStreaming && progressSteps.some((s) => s.status === "running");

  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      id: i,
      emoji: PARTICLE_EMOJIS[i % PARTICLE_EMOJIS.length],
      x: 10 + Math.random() * 80,
      delay: Math.random() * 3,
      duration: 4 + Math.random() * 4,
      size: 10 + Math.random() * 8,
    }));
  }, []);

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="absolute inset-0 overflow-hidden pointer-events-none z-10"
        >
          {particles.map((p) => (
            <motion.span
              key={p.id}
              className="absolute select-none"
              style={{
                left: `${p.x}%`,
                fontSize: p.size,
                filter: "blur(0.5px)",
              }}
              initial={{ y: "110%", opacity: 0, rotate: -30 }}
              animate={{
                y: [
                  "110%",
                  `${30 + Math.random() * 40}%`,
                  "-10%",
                ],
                opacity: [0, 0.6, 0],
                rotate: [0, 180, 360],
                x: [0, (Math.random() - 0.5) * 60, (Math.random() - 0.5) * 100],
              }}
              transition={{
                duration: p.duration,
                delay: p.delay,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              {p.emoji}
            </motion.span>
          ))}

          {/* Subtle gradient overlay at top */}
          <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-indigo-500/[0.03] to-transparent" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
