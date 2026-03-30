import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import mermaid from "mermaid";

mermaid.initialize({
  startOnLoad: false,
  theme: "base",
  themeVariables: {
    background: "#090d16",
    primaryColor: "#12172b",
    primaryTextColor: "#e8ecf4",
    primaryBorderColor: "#3d7be8",
    lineColor: "#5c6278",
    secondaryColor: "#1a2038",
    secondaryTextColor: "#8494ad",
    secondaryBorderColor: "#2eb89a",
    tertiaryColor: "#0d1220",
    tertiaryTextColor: "#8494ad",
    tertiaryBorderColor: "#5c6278",
    edgeLabelBackground: "#12172b",
    titleColor: "#e8ecf4",
    textColor: "#8494ad",
    clusterBkg: "#0d1220",
    clusterBorder: "rgba(61,123,232,0.2)",
    fontFamily: "'IBM Plex Sans', Inter, system-ui, sans-serif",
    noteTextColor: "#e8ecf4",
    noteBkgColor: "#1a2038",
    noteBorderColor: "rgba(61,123,232,0.3)",
    actorBkg: "#12172b",
    actorBorder: "rgba(61,123,232,0.4)",
    actorTextColor: "#e8ecf4",
    actorLineColor: "#5c6278",
    signalColor: "#8494ad",
    signalTextColor: "#e8ecf4",
    labelBoxBkgColor: "#12172b",
    labelBoxBorderColor: "rgba(61,123,232,0.3)",
    labelTextColor: "#e8ecf4",
    loopTextColor: "#8494ad",
    activationBorderColor: "#3d7be8",
    activationBkgColor: "rgba(61,123,232,0.12)",
  },
});

interface Props {
  code: string;
}

export function MermaidDiagram({ code }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;

    setLoading(true);
    setError(null);
    setSvg("");

    const id = `mermaid-${Math.random().toString(36).slice(2)}`;
    mermaid
      .render(id, code)
      .then(({ svg: rendered }) => {
        setSvg(rendered);
        setLoading(false);
      })
      .catch((err) => {
        setError(err?.message || "Failed to render diagram");
        setLoading(false);
      });
  }, [code]);

  return (
    <div className="mermaid-container">
      <AnimatePresence mode="wait">
        {loading && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center gap-3 py-10"
          >
            {/* Shimmer bars */}
            <div className="w-full max-w-sm space-y-2.5">
              {[80, 60, 90, 50, 70].map((w, i) => (
                <div
                  key={i}
                  className="h-3 rounded-full shimmer-bar"
                  style={{ width: `${w}%`, animationDelay: `${i * 0.1}s` }}
                />
              ))}
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mt-1">Rendering diagram...</p>
          </motion.div>
        )}

        {error && !loading && (
          <motion.div
            key="error"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-rose-500/8 border border-rose-500/20"
          >
            <span className="material-symbols-rounded text-[16px] text-rose-400 mt-0.5 shrink-0">error</span>
            <div>
              <p className="text-[11px] font-semibold text-rose-300 mb-0.5">Diagram render error</p>
              <p className="text-[10px] text-rose-400/70 leading-relaxed font-mono break-words">{error}</p>
            </div>
          </motion.div>
        )}

        {svg && !loading && !error && (
          <motion.div
            key="diagram"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            ref={containerRef}
            className="mermaid-svg-wrapper flex justify-center overflow-auto"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
