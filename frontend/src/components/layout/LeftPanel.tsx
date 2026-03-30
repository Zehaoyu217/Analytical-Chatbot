import { ModelSelector } from "@/components/settings/ModelSelector";
import { FileUpload } from "@/components/data/FileUpload";
import { DatasetList } from "@/components/data/DatasetList";
import { funText } from "@/lib/funText";

export function LeftPanel() {
  return (
    <aside className="h-full flex flex-col bg-[var(--surface-glass)] backdrop-blur-[20px] border-r border-[var(--border)] overflow-visible">
      {/* Logo / Branding */}
      <div className="px-3.5 pt-3.5 pb-2.5 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="relative w-8 h-8 rounded-[var(--radius-md)] overflow-hidden shadow-[var(--shadow-glow)]">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-purple-500 to-cyan-400" />
            <span className="material-symbols-rounded absolute inset-0 flex items-center justify-center text-white text-[var(--icon-md)]">
              auto_awesome
            </span>
          </div>
          <div>
            <h1 className="text-[14px] font-semibold text-[var(--text-primary)] leading-tight tracking-[-0.2px]">
              {funText.appTitle}
            </h1>
            <p className="text-[10px] text-[var(--text-muted)] leading-tight mt-0.5">
              {funText.tagline}
            </p>
          </div>
        </div>
      </div>

      {/* Model Selector */}
      <div className="px-3 pb-2.5 shrink-0 relative z-50">
        <SectionLabel>MODEL</SectionLabel>
        <ModelSelector />
      </div>

      <div className="mx-3 h-px bg-[var(--border)] shrink-0" />

      {/* File Upload */}
      <div className="px-3 pt-2.5 pb-2 shrink-0">
        <SectionLabel>DATA</SectionLabel>
        <FileUpload />
      </div>

      {/* Dataset List */}
      <div className="flex-1 overflow-y-auto px-2 pb-3 min-h-0">
        <DatasetList />
      </div>
    </aside>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-[1.2px] mb-1.5 px-0.5">
      {children}
    </p>
  );
}
