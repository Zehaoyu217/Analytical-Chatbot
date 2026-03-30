import { useState, useEffect } from "react";
import { ProgressPanel } from "./ProgressPanel";
import { ArtifactsPanel } from "./ArtifactsPanel";
import { AgentWorkspace } from "@/components/workspace/AgentWorkspace";

type Tab = "progress" | "artifacts" | "workspace";

const TABS = [
  { key: "progress" as const, label: "Exec", icon: "timeline", shortcut: "⌥1" },
  { key: "artifacts" as const, label: "Output", icon: "category", shortcut: "⌥2" },
  { key: "workspace" as const, label: "Canvas", icon: "dashboard", shortcut: "⌥3" },
];

export function RightPanel() {
  const [activeTab, setActiveTab] = useState<Tab>("progress");

  // Keyboard shortcuts: Alt+1/2/3 to switch tabs
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      if (e.key === "1") { e.preventDefault(); setActiveTab("progress"); }
      if (e.key === "2") { e.preventDefault(); setActiveTab("artifacts"); }
      if (e.key === "3") { e.preventDefault(); setActiveTab("workspace"); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="h-full flex flex-col bg-[var(--surface-1)] border-l border-[var(--border)]">
      {/* Tab strip */}
      <div role="tablist" aria-label="Right panel tabs" className="flex border-b border-[var(--border)] shrink-0">
        {TABS.map(({ key, label, icon, shortcut }) => (
          <button
            key={key}
            role="tab"
            aria-selected={activeTab === key}
            aria-controls={`tabpanel-${key}`}
            id={`tab-${key}`}
            onClick={() => setActiveTab(key)}
            title={`${label} (${shortcut})`}
            className={`flex-1 flex items-center justify-center gap-1 py-2 text-[10px] font-mono font-bold uppercase tracking-[0.5px] transition-all duration-150 border-b -mb-px ${
              activeTab === key
                ? "border-amber-500/80 text-amber-400"
                : "border-transparent text-[var(--text-dim)] hover:text-[var(--text-muted)]"
            }`}
          >
            <span className="material-symbols-rounded text-[13px]">{icon}</span>
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 flex flex-col min-h-0">
        {activeTab === "progress" && (
          <div role="tabpanel" id="tabpanel-progress" aria-labelledby="tab-progress" className="overflow-y-auto h-full w-full">
            <ProgressPanel />
          </div>
        )}
        {activeTab === "artifacts" && (
          <div role="tabpanel" id="tabpanel-artifacts" aria-labelledby="tab-artifacts" className="overflow-y-auto h-full w-full">
            <ArtifactsPanel />
          </div>
        )}
        {activeTab === "workspace" && (
          <div role="tabpanel" id="tabpanel-workspace" aria-labelledby="tab-workspace" className="flex-1 flex flex-col min-h-0">
            <AgentWorkspace />
          </div>
        )}
      </div>
    </div>
  );
}
