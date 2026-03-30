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
    <div className="px-6 pb-1 shrink-0">
      <div className="max-w-3xl mx-auto">
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="flex flex-wrap gap-2"
          >
            {suggestions.map((chip, i) => (
              <motion.button
                key={chip.prompt}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.06, duration: 0.2 }}
                onClick={() => onSend(chip.prompt)}
                className="group flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium
                  bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-secondary)]
                  hover:border-indigo-500/40 hover:text-indigo-300 hover:bg-indigo-500/8
                  active:scale-95 transition-all duration-150 cursor-pointer"
              >
                {chip.icon && (
                  <span className="material-symbols-rounded text-[14px] opacity-60 group-hover:opacity-100 transition-opacity">
                    {chip.icon}
                  </span>
                )}
                {chip.label}
                <span className="material-symbols-rounded text-[12px] opacity-0 group-hover:opacity-60 -mr-0.5 transition-opacity">
                  arrow_forward
                </span>
              </motion.button>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
