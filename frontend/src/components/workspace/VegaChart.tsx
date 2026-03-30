import { useRef, useEffect, useState } from "react";
import embed, { type Result } from "vega-embed";

interface Props {
  spec: string;
}

const FONT = "'IBM Plex Sans', Inter, system-ui, sans-serif";

// Professional dark theme matching our design system
const DARK_THEME_CONFIG = {
  background: "transparent",
  font: FONT,
  title: {
    color: "#e8ecf4",
    fontSize: 17,
    fontWeight: 700,
    font: FONT,
    anchor: "start" as const,
    offset: 12,
  },
  axis: {
    labelColor: "#8494ad",
    titleColor: "#8494ad",
    gridColor: "rgba(255,255,255,0.04)",
    domainColor: "rgba(255,255,255,0.1)",
    tickColor: "rgba(255,255,255,0.1)",
    labelFontSize: 13,   // tick values — one smaller than body
    titleFontSize: 14,   // X/Y axis titles — matches conversation body
    labelFont: FONT,
    titleFont: FONT,
    labelPadding: 6,
  },
  legend: {
    labelColor: "#8494ad",
    titleColor: "#e8ecf4",
    labelFontSize: 13,
    titleFontSize: 14,
    labelFont: FONT,
    titleFont: FONT,
    orient: "bottom",
    padding: 12,
  },
  view: {
    strokeWidth: 0,
  },
  range: {
    category: [
      "#3d7be8", "#2eb89a", "#e8a820", "#e05c7c", "#9b7fe8",
      "#5fb8d4", "#22c55e", "#f43f5e", "#e8a820", "#5c6278",
    ],
  },
};

// Custom tooltip styles for dark theme
const TOOLTIP_OPTS = {
  theme: "dark" as const,
  style: {
    "background-color": "#1a2038",
    "border": "1px solid rgba(255,255,255,0.11)",
    "border-radius": "6px",
    "padding": "7px 11px",
    "font-family": "'IBM Plex Sans', Inter, system-ui, sans-serif",
    "font-size": "12px",
    "color": "#e8ecf4",
    "box-shadow": "0 4px 16px rgba(0,0,0,0.45)",
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
