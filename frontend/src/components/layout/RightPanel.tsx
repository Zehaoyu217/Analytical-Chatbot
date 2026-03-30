import { useState, useCallback, useRef } from "react";
import { ProgressPanel } from "./ProgressPanel";
import { ArtifactsPanel } from "./ArtifactsPanel";
import { TracePanel } from "./TracePanel";
import { AgentWorkspace } from "@/components/workspace/AgentWorkspace";

/** Horizontal resize handle (drag up/down) */
function VerticalResizeHandle({ onDrag }: { onDrag: (deltaY: number) => void }) {
  const dragging = useRef(false);
  const lastY = useRef(0);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;
      lastY.current = e.clientY;

      const onMouseMove = (ev: MouseEvent) => {
        if (!dragging.current) return;
        const delta = ev.clientY - lastY.current;
        lastY.current = ev.clientY;
        onDrag(delta);
      };

      const onMouseUp = () => {
        dragging.current = false;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
    },
    [onDrag],
  );

  return (
    <div
      onMouseDown={onMouseDown}
      className="h-1 cursor-row-resize hover:bg-indigo-500/30 active:bg-indigo-500/50 transition-colors shrink-0 relative group mx-3"
    >
      {/* Wider invisible hit area */}
      <div className="absolute -top-1 -bottom-1 left-0 right-0" />
      {/* Visible line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-[var(--border)] group-hover:bg-indigo-500/40" />
    </div>
  );
}

export function RightPanel() {
  const [activeTab, setActiveTab] = useState<"progress" | "workspace" | "trace">("progress");
  // Progress section takes this percentage of the available height (0-100)
  const [progressPct, setProgressPct] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleResize = useCallback((deltaY: number) => {
    if (!containerRef.current) return;
    const containerHeight = containerRef.current.clientHeight;
    if (containerHeight <= 0) return;
    const deltaPct = (deltaY / containerHeight) * 100;
    setProgressPct((p) => Math.min(80, Math.max(20, p + deltaPct)));
  }, []);

  return (
    <div className="h-full flex flex-col bg-[var(--surface-glass)] backdrop-blur-[20px] border-l border-[var(--border)]">
      {/* Pill toggle tabs */}
      <div className="px-3 pt-3 pb-2 shrink-0">
        <div className="flex p-0.5 rounded-[var(--radius-sm)] bg-[var(--surface-2)] border border-[var(--border)]">
          {([
            { key: "progress" as const, label: "Progress", icon: "timeline" },
            { key: "workspace" as const, label: "Workspace", icon: "dashboard" },
            { key: "trace" as const, label: "Trace", icon: "bug_report" },
          ]).map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[11px] font-medium transition-all duration-150 ${
                activeTab === key
                  ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-[var(--shadow-sm)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              <span className="material-symbols-rounded text-[var(--icon-sm)]">{icon}</span>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div ref={containerRef} className="flex-1 flex flex-col min-h-0">
        {activeTab === "progress" ? (
          <>
            {/* Progress section */}
            <div className="overflow-y-auto" style={{ height: `${progressPct}%` }}>
              <ProgressPanel />
            </div>

            {/* Resize handle */}
            <VerticalResizeHandle onDrag={handleResize} />

            {/* Artifacts section */}
            <div className="overflow-y-auto flex-1">
              <ArtifactsPanel />
            </div>
          </>
        ) : activeTab === "trace" ? (
          <TracePanel />
        ) : (
          <AgentWorkspace />
        )}
      </div>
    </div>
  );
}
