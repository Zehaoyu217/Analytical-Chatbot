import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { SubagentMessage } from "@/types";

interface Props {
  message: SubagentMessage;
}

export const SubagentBubble = memo(function SubagentBubble({ message }: Props) {
  if (!message.content) return null;

  return (
    <div className="flex justify-end mb-3">
      <div className="max-w-[78%] w-full flex items-start gap-2">
        <div className="flex-1 min-w-0 px-3.5 py-2.5 rounded-[var(--radius-sm)] border border-violet-500/12 bg-[var(--surface-2)] relative overflow-hidden">

          {/* Top accent line */}
          <div className="absolute top-0 left-0 right-0 h-px bg-violet-500/25" />

          {/* Badge */}
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-[9px] font-mono font-bold text-violet-400/80 uppercase tracking-[1px] select-none">
              {message.agent_name.replace('_', ' ')}
            </span>
            {message.isStreaming && (
              <span className="flex items-center gap-0.5 ml-0.5">
                <span className="w-[3px] h-[3px] rounded-full bg-violet-400/70 animate-pulse" />
                <span className="w-[3px] h-[3px] rounded-full bg-violet-400/70 animate-pulse delay-75" />
              </span>
            )}
          </div>

          <div className="prose prose-invert prose-sm max-w-none
            prose-p:text-[var(--text-secondary)] prose-p:text-[13.5px] prose-p:leading-[1.65] prose-p:mb-2.5 prose-p:last:mb-0
            prose-headings:text-[var(--text-primary)] prose-headings:font-semibold prose-headings:mb-2 prose-headings:mt-3 prose-headings:first:mt-0
            prose-strong:text-[var(--text-primary)] prose-strong:font-semibold
            prose-li:text-[var(--text-secondary)] prose-li:text-[13.5px] prose-li:my-0.5 prose-li:leading-[1.6]
            prose-ul:my-2 prose-ol:my-2
            prose-a:text-violet-400 hover:prose-a:underline
          ">
            <div className={message.isStreaming ? "typing-cursor" : ""}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
