import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useModels, useSetActiveModel } from "@/hooks/useModels";
import { useSettingsStore } from "@/stores/settingsStore";

// Colors mapped to actual design system tokens
// --success: #10b981  --text-accent/--primary: #d4a017  --info: #38bdf8  --text-secondary: #8494ad
const providerColors: Record<string, string> = {
  ollama:      "#10b981",  // emerald — local/running (--success)
  openai:      "#10b981",  // emerald — same family
  anthropic:   "#d4a017",  // amber   — (--primary / --text-accent)
  google:      "#38bdf8",  // sky     — (--info)
  openrouter:  "#8494ad",  // muted   — (--text-secondary, neutral routing layer)
};
const FALLBACK_COLOR = "#8494ad"; // --text-secondary

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
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Model selector: ${currentModel?.name || model}`}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[var(--radius-sm)] bg-[var(--surface-3)] border border-[var(--border)] hover:border-[var(--border-strong)] transition-all duration-150 group"
      >
        <div
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: providerColors[provider] || FALLBACK_COLOR }}
        />
        <span className="text-[12px] font-mono font-medium text-[var(--text-primary)] flex-1 text-left truncate">
          {currentModel?.name || model}
        </span>
        <motion.span
          className="material-symbols-rounded text-[var(--icon-md)] text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] transition-colors"
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.15 }}
        >
          expand_more
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scaleY: 0.96 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -4, scaleY: 0.96 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            style={{ transformOrigin: "top center" }}
            className="absolute z-50 mt-1 w-full rounded-[var(--radius-sm)] bg-[var(--surface-2)] border border-[var(--border-strong)] shadow-[var(--shadow-md)] overflow-hidden"
          >
            <div role="listbox" aria-label="Available models" className="py-0.5 max-h-60 overflow-y-auto">
              {data?.models?.map((m: any) => {
                const isActive = m.model === model && m.provider === provider;
                return (
                  <button
                    key={`${m.provider}/${m.model}`}
                    role="option"
                    aria-selected={isActive}
                    onClick={() => handleSelect(m)}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left transition-all duration-100 ${
                      isActive
                        ? "bg-amber-500/8 border-l border-l-amber-400"
                        : "hover:bg-[var(--surface-3)] border-l border-l-transparent"
                    }`}
                  >
                    <div
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: providerColors[m.provider] || FALLBACK_COLOR }}
                    />
                    <div className="flex-1 min-w-0">
                      <span className={`text-[11px] font-mono font-medium truncate block ${isActive ? "text-[var(--text-accent)]" : "text-[var(--text-primary)]"}`}>
                        {m.name}
                      </span>
                      <span className="text-[9px] font-mono text-[var(--text-dim)]">
                        {m.provider} {m.local ? "\u00b7 local" : "\u00b7 cloud"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
