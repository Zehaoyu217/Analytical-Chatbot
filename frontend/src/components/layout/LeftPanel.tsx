import { ModelSelector } from "@/components/settings/ModelSelector";
import { FileUpload } from "@/components/data/FileUpload";
import { DatasetList } from "@/components/data/DatasetList";
import { funText } from "@/lib/funText";

export function LeftPanel() {
  return (
    <aside className="h-full flex flex-col bg-[var(--surface-1)] border-r border-[var(--border)] overflow-visible">
      {/* Logo / Branding */}
      <div className="px-3 pt-3 pb-2 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-amber-400/70 text-[11px] font-mono font-bold tracking-[0.15em] select-none">///</span>
          <div>
            <h1 className="text-[13px] font-bold text-[var(--text-primary)] leading-tight tracking-[-0.3px]">
              {funText.appTitle}
            </h1>
            <p className="text-[10px] text-[var(--text-dim)] leading-tight mt-0.5 font-mono">
              {funText.tagline}
            </p>
          </div>
        </div>
      </div>

      {/* Model Selector */}
      <div className="px-3 pb-2 shrink-0 relative z-50">
        <SectionLabel>{funText.sectionModel}</SectionLabel>
        <ModelSelector />
      </div>

      <div className="mx-3 h-px bg-[var(--border)] shrink-0" />

      {/* File Upload */}
      <div className="px-3 pt-2 pb-1.5 shrink-0">
        <SectionLabel>{funText.sectionData}</SectionLabel>
        <FileUpload />
      </div>

      {/* Dataset List */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 min-h-0">
        <DatasetList />
      </div>

      {/* Keyboard shortcut reference */}
      <div className="px-3 pb-2.5 pt-1.5 shrink-0 border-t border-[var(--border)]">
        <p className="text-[9px] text-[var(--text-dim)] font-mono leading-[1.8] tracking-wide">
          <span className="text-[var(--text-muted)]">⌘K</span> new
          {" · "}
          <span className="text-[var(--text-muted)]">Esc</span> stop
          {" · "}
          <span className="text-[var(--text-muted)]">⌥1-3</span> panels
        </p>
      </div>
    </aside>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-[9px] font-bold text-[var(--text-dim)] uppercase tracking-[1.5px] mb-1 px-0.5">
      {children}
    </p>
  );
}
