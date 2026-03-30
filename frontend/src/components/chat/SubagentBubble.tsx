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
    <div className="flex justify-end mb-4">
      <div className="max-w-[78%] w-full flex items-start gap-3">
        <div className="flex-1 min-w-0 px-5 py-3.5 rounded-2xl rounded-tr-sm border border-indigo-500/20 bg-gradient-to-br from-[var(--surface-2)] to-indigo-900/10 shadow-[var(--shadow-sm)] relative overflow-hidden">
          
          {/* Top colored accent bar */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-indigo-500 to-purple-500 opacity-70" />

          {/* Badge */}
          <div className="flex items-center gap-1.5 mb-2.5">
            <span className="material-symbols-rounded text-[14px] text-indigo-400">psychology</span>
            <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider select-none">
              {message.agent_name.replace('_', ' ')} • Parallel Update
            </span>
            {message.isStreaming && (
              <span className="flex items-center gap-1 ml-1 mb-0.5">
                <span className="w-1 h-1 rounded-full bg-indigo-400 animate-pulse" />
                <span className="w-1 h-1 rounded-full bg-indigo-400 animate-pulse delay-75" />
                <span className="w-1 h-1 rounded-full bg-indigo-400 animate-pulse delay-150" />
              </span>
            )}
          </div>

          <div className="prose prose-invert prose-sm max-w-none
            prose-p:text-[var(--text-secondary)] prose-p:text-[13.5px] prose-p:leading-[1.65] prose-p:mb-2.5 prose-p:last:mb-0
            prose-headings:text-[var(--text-primary)] prose-headings:font-semibold prose-headings:mb-2 prose-headings:mt-3 prose-headings:first:mt-0
            prose-strong:text-[var(--text-primary)] prose-strong:font-semibold
            prose-li:text-[var(--text-secondary)] prose-li:text-[13.5px] prose-li:my-0.5 prose-li:leading-[1.6]
            prose-ul:my-2 prose-ol:my-2
            prose-a:text-indigo-400 hover:prose-a:underline
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
