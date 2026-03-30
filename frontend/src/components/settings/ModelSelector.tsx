import { useState, useRef, useEffect } from "react";
import { useModels, useSetActiveModel } from "@/hooks/useModels";
import { useSettingsStore } from "@/stores/settingsStore";

const providerColors: Record<string, string> = {
  ollama: "#10b981",
  openai: "#10b981",
  anthropic: "#f59e0b",
  google: "#38bdf8",
  openrouter: "#a78bfa",
};

export function ModelSelector() {
  const { data } = useModels();
  const { mutate: setActive } = useSetActiveModel();
  const { model, provider, setModel, setProvider } = useSettingsStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Sync with backend's active model on initial load
  useEffect(() => {
    if (data?.active) {
      const active = data.active as { provider: string; model: string };
      if (active.provider && active.model) {
        setProvider(active.provider);
        setModel(active.model);
      }
    }
  }, [data?.active, setProvider, setModel]);

  const currentModel = data?.models?.find(
    (m: any) => m.model === model && m.provider === provider
  );

  const handleSelect = (m: any) => {
    setProvider(m.provider);
    setModel(m.model);
    setActive({ provider: m.provider, model: m.model });
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[var(--radius-md)] bg-[var(--surface-3)] border border-[var(--border)] hover:border-[var(--border-strong)] transition-all duration-150 group"
      >
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{
            background: providerColors[provider] || "#6366f1",
            boxShadow: `0 0 6px ${providerColors[provider] || "#6366f1"}99`,
          }}
        />
        <span className="text-[13px] font-medium text-[var(--text-primary)] flex-1 text-left truncate">
          {currentModel?.name || model}
        </span>
        <span className="material-symbols-rounded text-[var(--icon-md)] text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] transition-colors">
          expand_more
        </span>
      </button>

      {open && (
        <div
          className="absolute z-50 mt-1.5 w-full rounded-[var(--radius-md)] bg-[var(--surface-2)] backdrop-blur-xl border border-[var(--border-strong)] shadow-[var(--glow-card)] overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150"
        >
          <div className="py-1 max-h-64 overflow-y-auto">
            {data?.models?.map((m: any) => {
              const isActive = m.model === model && m.provider === provider;
              return (
                <button
                  key={`${m.provider}/${m.model}`}
                  onClick={() => handleSelect(m)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-all duration-100 ${
                    isActive
                      ? "bg-indigo-500/10 border-l-2 border-l-indigo-400"
                      : "hover:bg-[var(--surface-3)] border-l-2 border-l-transparent"
                  }`}
                >
                  <div
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: providerColors[m.provider] || "#6366f1" }}
                  />
                  <div className="flex-1 min-w-0">
                    <span className={`text-[12px] font-medium truncate block ${isActive ? "text-[var(--text-accent)]" : "text-[var(--text-primary)]"}`}>
                      {m.name}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {m.provider} {m.local ? "\u00b7 local" : "\u00b7 cloud"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
