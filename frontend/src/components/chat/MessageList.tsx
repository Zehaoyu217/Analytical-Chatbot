import { useEffect, useRef, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useChatStore } from "@/stores/chatStore";
import { MessageBubble } from "./MessageBubble";
import { SubagentBubble } from "./SubagentBubble";

const messageVariants = {
  hidden: { opacity: 0, y: 14, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
};

export const MessageList = memo(function MessageList() {
  const messages = useChatStore((s) => s.messages);
  const subagentMessages = useChatStore((s) => s.subagentMessages);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const scrollRafRef = useRef<number | null>(null);

  // Track if user is near bottom (auto-scroll only when near bottom)
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const threshold = 120;
    isNearBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  }, []);

  // Debounced scroll-to-bottom using rAF (prevents smooth-scroll pileup)
  useEffect(() => {
    if (!isNearBottomRef.current) return;
    if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
    scrollRafRef.current = requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "instant" });
      scrollRafRef.current = null;
    });
    return () => {
      if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
    };
  }, [messages]);

  if (messages.length === 0 && subagentMessages.length === 0) {
    return null;
  }

  // Interleave main messages and subagent messages by timestamp
  const allItems = [...messages, ...subagentMessages].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 min-h-0 overflow-y-auto px-6 py-6"
    >
      <div className="max-w-3xl mx-auto">
        <AnimatePresence initial={false}>
          {allItems.map((item) => (
            <motion.div
              key={item.id}
              variants={messageVariants}
              initial="hidden"
              animate="visible"
              layout={false}
            >
              {"role" in item ? (
                <MessageBubble message={item} />
              ) : (
                <SubagentBubble message={item} />
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={bottomRef} className="h-4" />
      </div>
    </div>
  );
});
