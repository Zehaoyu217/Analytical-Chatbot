import { useRef, useEffect, useState } from "react";
import mermaid from "mermaid";

mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  themeVariables: {
    darkMode: true,
    background: "#111111",
    primaryColor: "#3b82f6",
    primaryTextColor: "#fafafa",
    lineColor: "#71717a",
  },
});

interface Props {
  code: string;
}

export function MermaidDiagram({ code }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");

  useEffect(() => {
    if (!code) return;

    const id = `mermaid-${Math.random().toString(36).slice(2)}`;
    mermaid
      .render(id, code)
      .then(({ svg }) => setSvg(svg))
      .catch(console.error);
  }, [code]);

  return (
    <div
      ref={containerRef}
      className="flex justify-center"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
