import { useRef, useEffect, useState } from "react";
import embed, { type Result } from "vega-embed";

interface Props {
  spec: string;
}

// Professional dark theme matching our design system
const DARK_THEME_CONFIG = {
  background: "transparent",
  font: "Inter",
  title: {
    color: "#f1f3f9",
    fontSize: 14,
    fontWeight: 600,
    font: "Inter",
    anchor: "start" as const,
    offset: 10,
  },
  axis: {
    labelColor: "#9da3b4",
    titleColor: "#9da3b4",
    gridColor: "rgba(255,255,255,0.04)",
    domainColor: "rgba(255,255,255,0.1)",
    tickColor: "rgba(255,255,255,0.1)",
    labelFontSize: 11,
    titleFontSize: 12,
    labelFont: "Inter",
    titleFont: "Inter",
  },
  legend: {
    labelColor: "#9da3b4",
    titleColor: "#f1f3f9",
    labelFontSize: 11,
    titleFontSize: 12,
    labelFont: "Inter",
    titleFont: "Inter",
  },
  view: {
    strokeWidth: 0,
  },
  range: {
    category: [
      "#818cf8", "#a78bfa", "#22d3ee", "#10b981", "#f59e0b",
      "#f43f5e", "#ec4899", "#6366f1", "#14b8a6", "#8b5cf6",
    ],
  },
};

// Custom tooltip styles for dark theme
const TOOLTIP_OPTS = {
  theme: "dark" as const,
  style: {
    "background-color": "rgba(15, 17, 26, 0.95)",
    "border": "1px solid rgba(129, 140, 248, 0.2)",
    "border-radius": "8px",
    "padding": "8px 12px",
    "font-family": "Inter, system-ui, sans-serif",
    "font-size": "12px",
    "color": "#e2e8f0",
    "box-shadow": "0 4px 20px rgba(0, 0, 0, 0.4)",
    "backdrop-filter": "blur(8px)",
  },
};

export function VegaChart({ spec }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || !spec) return;

    let cancelled = false;

    async function render() {
      try {
        setError(null);
        const parsed = typeof spec === "string" ? JSON.parse(spec) : spec;

        // Enhance spec for interactivity
        const enhanced = enhanceSpec(parsed);

        // Preserve spec dimensions for aspect ratio; only use container-fit as fallback
        const specWidth = enhanced.width;
        const specHeight = enhanced.height;
        const hasFixedDimensions =
          typeof specWidth === "number" && typeof specHeight === "number";

        const themed: any = {
          ...enhanced,
          config: {
            ...DARK_THEME_CONFIG,
            ...(enhanced.config || {}),
          },
        };

        if (hasFixedDimensions) {
          // Keep spec's fixed dimensions — the CSS wrapper handles responsive scaling
          themed.width = specWidth;
          themed.height = specHeight;
          themed.autosize = { type: "pad", contains: "padding" };
        } else {
          // No fixed dimensions — fill container
          themed.width = "container";
          themed.autosize = { type: "fit", contains: "padding" };
        }

        if (cancelled) return;

        const result = await embed(containerRef.current!, themed, {
          actions: {
            export: true,
            source: false,
            compiled: false,
            editor: false,
          },
          renderer: "svg",
          tooltip: TOOLTIP_OPTS,
        });

        resultRef.current = result;
      } catch (e: any) {
        if (!cancelled) {
          setError(e.message || "Failed to render chart");
        }
      }
    }

    render();

    return () => {
      cancelled = true;
      if (resultRef.current) {
        resultRef.current.finalize();
        resultRef.current = null;
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [spec]);

  if (error) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[12px] text-rose-400">
        <span className="material-symbols-rounded text-[14px]">error</span>
        Chart error: {error}
      </div>
    );
  }

  // Parse spec to get aspect ratio for the wrapper
  let aspectStyle: React.CSSProperties = {};
  try {
    const parsed = typeof spec === "string" ? JSON.parse(spec) : spec;
    if (typeof parsed.width === "number" && typeof parsed.height === "number") {
      aspectStyle = {
        aspectRatio: `${parsed.width} / ${parsed.height}`,
        maxWidth: `${parsed.width}px`,
        width: "100%",
      };
    }
  } catch {
    // ignore parse errors — just render without aspect constraint
  }

  return (
    <div style={aspectStyle} className="vega-chart-container">
      <div ref={containerRef} className="w-full h-full [&_svg]:w-full [&_svg]:h-full" />
    </div>
  );
}

/**
 * Enhance a Vega-Lite spec with interactive features if not already present.
 * - Adds tooltips to marks that don't have them
 * - Preserves existing selections/params
 * - Adds hover highlight if no selection exists
 */
function enhanceSpec(spec: any): any {
  if (!spec || typeof spec !== "object") return spec;

  // For layered/concat specs, enhance each layer
  if (spec.layer) {
    return {
      ...spec,
      layer: spec.layer.map((l: any) => enhanceMarkTooltip(l)),
    };
  }
  if (spec.hconcat) {
    return { ...spec, hconcat: spec.hconcat.map((s: any) => enhanceSpec(s)) };
  }
  if (spec.vconcat) {
    return { ...spec, vconcat: spec.vconcat.map((s: any) => enhanceSpec(s)) };
  }

  // Single-view spec
  const enhanced = enhanceMarkTooltip(spec);

  // Add interactive highlight if no params/selection already defined
  if (!enhanced.params && !enhanced.selection && enhanced.mark) {
    const markType = typeof enhanced.mark === "string" ? enhanced.mark : enhanced.mark?.type;
    if (markType && ["bar", "point", "circle", "line", "area", "rect"].includes(markType)) {
      enhanced.params = [
        {
          name: "hover",
          select: { type: "point", on: "pointerover", clear: "pointerout" },
        },
      ];
      // Add opacity condition for hover
      if (enhanced.encoding && !enhanced.encoding.opacity) {
        enhanced.encoding = {
          ...enhanced.encoding,
          opacity: {
            condition: { param: "hover", value: 1 },
            value: 0.7,
          },
        };
      }
    }
  }

  return enhanced;
}

/** Add tooltip: true to marks that don't have explicit tooltip encoding */
function enhanceMarkTooltip(spec: any): any {
  if (!spec || typeof spec !== "object") return spec;
  if (!spec.mark && !spec.encoding) return spec;

  const result = { ...spec };

  // Add tooltip encoding if not present
  if (result.encoding && !result.encoding.tooltip) {
    result.encoding = {
      ...result.encoding,
      tooltip: { content: "data" },
    };
  }

  return result;
}
