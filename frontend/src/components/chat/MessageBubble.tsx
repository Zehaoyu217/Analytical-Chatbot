import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "./CodeBlock";
import { VegaChart } from "@/components/workspace/VegaChart";
import { MermaidDiagram } from "@/components/workspace/MermaidDiagram";
import { useChatStore } from "@/stores/chatStore";
import type { Message, Artifact } from "@/types";

interface Props {
  message: Message;
}

export const MessageBubble = memo(function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";

  // MUST call hooks unconditionally (React rules of hooks)
  const artifacts = useChatStore((s) => s.artifacts);

  if (isUser) {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[72%] px-4 py-2.5 rounded-2xl rounded-br-md bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-[14px] leading-[1.65] shadow-[var(--shadow-md)]">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  // Thinking state (streaming, no content yet)
  if (message.isStreaming && !message.content) {
    return (
      <div className="flex items-start gap-3 mb-4">
        <AvatarIcon />
        <div className="px-4 py-3 rounded-2xl rounded-tl-md bg-[var(--surface-2)] border border-[var(--border)]">
          <div className="flex gap-1.5 items-center h-5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-[6px] h-[6px] rounded-full bg-indigo-400"
                style={{
                  animation: `gemini-dot 1.4s ease-in-out ${i * 0.18}s infinite`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Get inline artifacts for this message
  const inlineArtifacts = (message.artifactIds || [])
    .map((id) => artifacts.find((a) => a.id === id))
    .filter((a): a is Artifact => !!a);

  // Assistant message
  return (
    <div className="flex items-start gap-3 mb-4 max-w-[88%]">
      <AvatarIcon />
      <div className="flex-1 min-w-0 px-4 py-3 rounded-2xl rounded-tl-md border border-[var(--border)] bg-[var(--surface-2)]">
        {message.thoughtProcess && (
          <details className="mb-3 group">
            <summary className="cursor-pointer text-[13px] font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 outline-none select-none">
              <span className="material-symbols-rounded text-[16px] transition-transform group-open:rotate-90">
                chevron_right
              </span>
              Agent Thought Process
            </summary>
            <div className="mt-2 pl-4 py-1 border-l-2 border-indigo-500/30">
              <div className="prose prose-invert prose-sm max-w-none 
                prose-p:text-[var(--text-secondary)] prose-p:text-[13px] prose-p:leading-[1.6] 
                prose-headings:text-[var(--text-secondary)] prose-strong:text-[var(--text-secondary)]
                prose-code:text-indigo-300/80">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {message.thoughtProcess}
                </ReactMarkdown>
              </div>
            </div>
          </details>
        )}
        <div className="prose prose-invert prose-sm max-w-none
          prose-p:text-[var(--text-primary)] prose-p:text-[14px] prose-p:leading-[1.7] prose-p:mb-3 prose-p:last:mb-0
          prose-headings:text-[var(--text-primary)] prose-headings:font-semibold prose-headings:mb-2 prose-headings:mt-4 prose-headings:first:mt-0
          prose-h3:text-[15px] prose-h4:text-[14px]
          prose-strong:text-[var(--text-primary)] prose-strong:font-semibold
          prose-code:text-indigo-300 prose-code:font-normal prose-code:text-[13px]
          prose-li:text-[var(--text-primary)] prose-li:text-[14px] prose-li:my-0.5 prose-li:leading-[1.65]
          prose-ul:my-2 prose-ol:my-2
          prose-a:text-indigo-400 prose-a:no-underline hover:prose-a:underline
          prose-blockquote:border-indigo-500/30 prose-blockquote:text-[var(--text-secondary)]
          prose-table:text-[13px]
          prose-th:text-[var(--text-secondary)] prose-th:font-medium prose-th:text-left prose-th:px-3 prose-th:py-2 prose-th:bg-[var(--surface-3)] prose-th:border-b prose-th:border-[var(--border)]
          prose-td:text-[var(--text-primary)] prose-td:px-3 prose-td:py-1.5 prose-td:border-b prose-td:border-[var(--border)]
        ">
          <div className={message.isStreaming && message.content ? "typing-cursor" : ""}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || "");
                  const isInline = !match;
                  if (isInline) {
                    return (
                      <code
                        className="bg-[var(--surface-3)] px-1.5 py-0.5 rounded-md text-[13px] text-indigo-300 font-mono"
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  }
                  return (
                    <CodeBlock language={match[1]}>
                      {String(children).replace(/\n$/, "")}
                    </CodeBlock>
                  );
                },
                table({ children }) {
                  return (
                    <div className="my-3 overflow-x-auto rounded-lg border border-[var(--border)]">
                      <table className="w-full border-collapse">{children}</table>
                    </div>
                  );
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        </div>
        {message.figures?.map((fig, i) => (
          <img
            key={i}
            src={`data:image/png;base64,${fig}`}
            alt={`Figure ${i + 1}`}
            className="mt-3 rounded-lg max-w-full"
          />
        ))}

        {/* Inline artifacts — charts, tables, diagrams */}
        {inlineArtifacts.map((artifact) => (
          <InlineArtifact key={artifact.id} artifact={artifact} />
        ))}
      </div>
    </div>
  );
});

const artifactIcon: Record<string, string> = {
  chart: "bar_chart",
  table: "table_chart",
  diagram: "schema",
};

const artifactColor: Record<string, string> = {
  chart: "text-indigo-400",
  table: "text-emerald-400",
  diagram: "text-purple-400",
};

function InlineArtifact({ artifact }: { artifact: Artifact }) {
  const icon = artifactIcon[artifact.type] || "description";
  const color = artifactColor[artifact.type] || "text-indigo-400";

  return (
    <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface-glass)] overflow-hidden">
      {artifact.title && (
        <div className="px-3 py-2 border-b border-[var(--border)] flex items-center gap-2">
          <span className={`material-symbols-rounded text-[var(--icon-sm)] ${color}`}>{icon}</span>
          <span className="text-[12px] font-semibold text-[var(--text-primary)]">{artifact.title}</span>
        </div>
      )}
      <div className="p-3 overflow-x-auto">
        {artifact.type === "chart" && artifact.format === "vega-lite" && (
          <VegaChart spec={artifact.content} />
        )}
        {artifact.type === "table" && (
          <div
            className="artifact-table-inline text-[13px]
              [&_table]:w-full [&_table]:border-collapse
              [&_th]:text-left [&_th]:px-3 [&_th]:py-2 [&_th]:text-[var(--text-secondary)] [&_th]:font-medium [&_th]:bg-[var(--surface-3)] [&_th]:border-b [&_th]:border-[var(--border)]
              [&_td]:px-3 [&_td]:py-1.5 [&_td]:text-[var(--text-primary)] [&_td]:border-b [&_td]:border-[var(--border)]
              [&_tr:last-child_td]:border-b-0"
            dangerouslySetInnerHTML={{ __html: artifact.content }}
          />
        )}
        {artifact.type === "diagram" && artifact.format === "mermaid" && (
          <MermaidDiagram code={artifact.content} />
        )}
      </div>
    </div>
  );
}

function AvatarIcon() {
  return (
    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 via-purple-500 to-cyan-400 flex items-center justify-center shrink-0 mt-0.5 shadow-[var(--shadow-glow)]">
      <span className="material-symbols-rounded text-white text-[var(--icon-sm)]">
        auto_awesome
      </span>
    </div>
  );
}
