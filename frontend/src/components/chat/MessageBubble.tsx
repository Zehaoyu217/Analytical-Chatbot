import { memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "./CodeBlock";
import { VegaChart } from "@/components/workspace/VegaChart";
import { MermaidDiagram } from "@/components/workspace/MermaidDiagram";
import { ComponentRenderer } from "@/components/workspace/DashboardRenderer";
import { TableArtifact } from "@/components/layout/ArtifactsPanel";
import { useChatStore } from "@/stores/chatStore";
import type { Message, Artifact, InlineComponentGroup } from "@/types";

interface Props {
  message: Message;
  onRetry?: () => void;
}

export const MessageBubble = memo(function MessageBubble({ message, onRetry }: Props) {
  const isUser = message.role === "user";

  // MUST call hooks unconditionally (React rules of hooks)
  const artifacts = useChatStore((s) => s.artifacts);

  if (isUser) {
    return (
      <div className="flex justify-end mb-3">
        <div className="max-w-[80%]">
          <div className="px-3.5 py-2 rounded-[var(--radius-sm)] bg-[var(--surface-3)] text-[var(--text-primary)] text-[14px] leading-[1.6] border border-[var(--border-strong)]">
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>
        </div>
      </div>
    );
  }

  // Thinking state (streaming, no content yet)
  if (message.isStreaming && !message.content) {
    return (
      <div className="mb-3">
        <div className="inline-flex px-2.5 py-2 rounded-[var(--radius-sm)] bg-[var(--surface-2)] border border-[var(--border)]">
          <div className="flex gap-1 items-center h-4">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-[4px] h-[4px] rounded-full bg-amber-400/80"
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

  const inlineComponentGroups = message.inlineComponentGroups || [];

  // Assistant message
  return (
    <div className="mb-3 max-w-[94%]">
      <div className="px-3.5 py-2.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-2)]">
        {message.thoughtProcess && (
          <details className="mb-3 group">
            <summary className="cursor-pointer text-[13px] font-medium text-amber-400/70 hover:text-amber-400 flex items-center gap-1.5 outline-none select-none">
              <span className="material-symbols-rounded text-[14px] transition-transform group-open:rotate-90">
                chevron_right
              </span>
              <span className="text-[10px] font-mono uppercase tracking-[0.5px]">reasoning</span>
            </summary>
            <div className="mt-1.5 pl-3 py-1 border-l border-amber-500/20 max-h-[400px] overflow-y-auto">
              <div className="text-[11px] font-mono text-[var(--text-muted)] whitespace-pre-wrap break-words leading-[1.6]">
                {message.thoughtProcess}
              </div>
            </div>
          </details>
        )}
        <div className="prose prose-invert prose-sm max-w-none
          prose-p:text-[var(--text-primary)] prose-p:text-[14px] prose-p:leading-[1.7] prose-p:mb-3 prose-p:last:mb-0
          prose-headings:text-[var(--text-primary)] prose-headings:font-semibold prose-headings:mb-2 prose-headings:mt-4 prose-headings:first:mt-0
          prose-h3:text-[15px] prose-h4:text-[14px]
          prose-strong:text-[var(--text-primary)] prose-strong:font-semibold
          prose-code:text-amber-300 prose-code:font-normal prose-code:text-[13px]
          prose-li:text-[var(--text-primary)] prose-li:text-[14px] prose-li:my-0.5 prose-li:leading-[1.65]
          prose-ul:my-2 prose-ol:my-2
          prose-a:text-amber-400 prose-a:no-underline hover:prose-a:underline
          prose-blockquote:border-amber-500/30 prose-blockquote:text-[var(--text-secondary)]
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
                        className="bg-[var(--surface-3)] px-1.5 py-0.5 rounded-sm text-[13px] text-amber-300 font-mono"
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
                    <div className="my-3 overflow-x-auto rounded-sm border border-[var(--border)]">
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
            className="mt-3 rounded-sm max-w-full"
          />
        ))}

        {/* Inline artifacts — charts, tables, diagrams */}
        {inlineArtifacts.map((artifact) => (
          <InlineArtifact key={artifact.id} artifact={artifact} />
        ))}

        {/* Inline A2UI component groups */}
        {inlineComponentGroups.map((group) => (
          <InlineComponentBlock key={group.id} group={group} />
        ))}

        {/* Message actions */}
        {!message.isStreaming && (
          <MessageActions content={message.content} onRetry={onRetry} />
        )}
      </div>
    </div>
  );
});

/* ── Message action bar (copy + retry) ──────────────────── */
function MessageActions({
  content,
  onRetry,
}: {
  content: string;
  onRetry?: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex items-center gap-1 mt-1.5 pt-1.5 border-t border-[var(--border)] opacity-0 hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150">
      <button
        onClick={handleCopy}
        className="flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[10px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-3)] transition-all duration-100"
        title="Copy response"
      >
        <span className="material-symbols-rounded text-[12px]">
          {copied ? "check" : "content_copy"}
        </span>
        {copied ? "Copied" : "Copy"}
      </button>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[10px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-3)] transition-all duration-100"
          title="Retry — re-send the previous message"
        >
          <span className="material-symbols-rounded text-[12px]">refresh</span>
          Retry
        </button>
      )}
    </div>
  );
}

function InlineArtifact({ artifact }: { artifact: Artifact }) {
  // Charts and diagrams must NOT have overflow-x-auto — it implicitly sets
  // overflow-y:auto which creates a scroll container that clips the vega-embed
  // action dropdown (absolutely positioned inside .vega-embed).
  if (artifact.format === "vega-lite") {
    return <div className="mt-3"><VegaChart spec={artifact.content} /></div>;
  }
  if (artifact.format === "mermaid") {
    return <div className="mt-3"><MermaidDiagram code={artifact.content} /></div>;
  }
  // Tables and raw HTML may be wide — allow horizontal scroll here only.
  return (
    <div className="mt-3 overflow-x-auto">
      {artifact.format === "table-json" ? (
        <TableArtifact content={artifact.content} />
      ) : (
        <div
          className="artifact-table-inline text-[13px]
            [&_table]:w-full [&_table]:border-collapse
            [&_th]:text-left [&_th]:px-3 [&_th]:py-2 [&_th]:text-[var(--text-secondary)] [&_th]:font-medium [&_th]:bg-[var(--surface-3)] [&_th]:border-b [&_th]:border-[var(--border)]
            [&_td]:px-3 [&_td]:py-1.5 [&_td]:text-[var(--text-primary)] [&_td]:border-b [&_td]:border-[var(--border)]
            [&_tr:last-child_td]:border-b-0"
          dangerouslySetInnerHTML={{ __html: artifact.content }}
        />
      )}
    </div>
  );
}

function InlineComponentBlock({ group }: { group: InlineComponentGroup }) {
  if (!group.components.length) return null;
  return (
    <div className="mt-2 space-y-1.5">
      {group.title && (
        <div className="flex items-center gap-2 mt-3 mb-1" aria-hidden="true">
          <div className="h-px flex-1 bg-[var(--border)]" />
          <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-[1px] shrink-0">
            {group.title}
          </p>
          <div className="h-px flex-1 bg-[var(--border)]" />
        </div>
      )}
      {group.components.map((comp, i) => (
        <ComponentRenderer key={i} component={comp} />
      ))}
    </div>
  );
}

