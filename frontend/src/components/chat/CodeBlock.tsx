import { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { nightOwl } from "react-syntax-highlighter/dist/esm/styles/prism";

interface Props {
  language: string;
  children: string;
}

export function CodeBlock({ language, children }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 rounded-[var(--radius-md)] overflow-hidden border border-[var(--border)] bg-[#0d0f14]">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--surface-2)] border-b border-[var(--border)]">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono font-medium text-[var(--text-muted)] uppercase tracking-[0.5px]">{language}</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius-sm)] text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-3)] transition-all duration-150"
        >
          <span className="material-symbols-rounded text-[var(--icon-xs)]">
            {copied ? "check" : "content_copy"}
          </span>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <SyntaxHighlighter
        language={language}
        style={nightOwl}
        customStyle={{
          margin: 0,
          background: "#0d0f14",
          fontSize: "13px",
          lineHeight: "1.65",
          padding: "16px",
        }}
      >
        {children}
      </SyntaxHighlighter>
    </div>
  );
}
