import { motion, AnimatePresence } from "framer-motion";
import { useChatStore } from "@/stores/chatStore";

interface Props {
  onSend: (message: string) => void;
}

export function SuggestionChips({ onSend }: Props) {
  const suggestions = useChatStore((s) => s.suggestions);
  const isStreaming = useChatStore((s) => s.isStreaming);

  if (suggestions.length === 0 || isStreaming) return null;

  return (
    <div className="px-5 pb-1 shrink-0">
      <div className="max-w-3xl mx-auto">
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-wrap gap-1.5"
          >
            {suggestions.map((chip, i) => (
              <motion.button
                key={chip.prompt}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.04, duration: 0.15 }}
                onClick={() => onSend(chip.prompt)}
                className="group flex items-center gap-1 px-2.5 py-1 rounded-[var(--radius-sm)] text-[11px] font-mono
                  bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-muted)]
                  hover:border-amber-500/35 hover:text-amber-400
                  active:scale-[0.97] transition-all duration-150 cursor-pointer"
              >
                {chip.icon && (
                  <span className="material-symbols-rounded text-[12px] opacity-50 group-hover:opacity-80 transition-opacity">
                    {chip.icon}
                  </span>
                )}
                {chip.label}
              </motion.button>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
