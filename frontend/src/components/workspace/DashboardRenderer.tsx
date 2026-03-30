import { motion } from "framer-motion";
import type { Artifact, DashboardComponent } from "@/types";
import { VegaChart } from "./VegaChart";
import { MermaidDiagram } from "./MermaidDiagram";

interface Props {
  components: DashboardComponent[];
  artifacts: Artifact[];
}

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.3, ease: "easeOut" as const } },
};

export function DashboardRenderer({ components, artifacts }: Props) {
  return (
    <motion.div
      className="space-y-3"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Dashboard components */}
      {components.map((comp, i) => (
        <motion.div key={`comp-${i}`} variants={itemVariants}>
          <ComponentRenderer component={comp} />
        </motion.div>
      ))}

      {/* Chart/table artifacts */}
      {artifacts
        .filter((a) => a.type === "chart" || a.type === "table")
        .map((artifact) => (
          <motion.div
            key={artifact.id}
            variants={itemVariants}
            className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-glass)] backdrop-blur-xl overflow-hidden"
          >
            {artifact.title && (
              <div className="px-4 py-2.5 border-b border-[var(--border)] flex items-center gap-2">
                <span className="material-symbols-rounded text-[var(--icon-sm)] text-indigo-400">
                  {artifact.type === "chart" ? "bar_chart" : "table_chart"}
                </span>
                <span className="text-[12px] font-semibold text-[var(--text-primary)]">
                  {artifact.title}
                </span>
              </div>
            )}
            <div className="p-3">
              {artifact.format === "vega-lite" && <VegaChart spec={artifact.content} />}
              {artifact.format === "html" && (
                <div
                  className="artifact-table-container text-[12px] overflow-auto text-[var(--text-secondary)]"
                  dangerouslySetInnerHTML={{ __html: artifact.content }}
                />
              )}
              {artifact.format === "mermaid" && <MermaidDiagram code={artifact.content} />}
            </div>
          </motion.div>
        ))}
    </motion.div>
  );
}

/** Renders a single dashboard component */
function ComponentRenderer({ component }: { component: DashboardComponent }) {
  switch (component.type) {
    case "metric":
      return <MetricCard component={component} />;
    case "grid":
      return <GridLayout component={component} />;
    case "text":
      return <TextBlock component={component} />;
    default:
      return (
        <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-glass)] backdrop-blur-xl p-3">
          <pre className="text-[12px] text-[var(--text-muted)] overflow-auto">
            {JSON.stringify(component, null, 2)}
          </pre>
        </div>
      );
  }
}

function MetricCard({ component }: { component: DashboardComponent }) {
  const changeType = component.changeType as string;
  const icon = component.icon as string;
  const subtitle = component.subtitle as string;
  const changeIcon =
    changeType === "positive"
      ? "trending_up"
      : changeType === "negative"
        ? "trending_down"
        : "remove";
  const changeColor =
    changeType === "positive"
      ? "text-emerald-400"
      : changeType === "negative"
        ? "text-rose-400"
        : "text-[var(--text-muted)]";

  const orbGradient =
    changeType === "positive"
      ? "radial-gradient(circle, #10b981, transparent)"
      : changeType === "negative"
        ? "radial-gradient(circle, #f43f5e, transparent)"
        : "radial-gradient(circle, #6366f1, transparent)";

  return (
    <motion.div
      whileHover={{ scale: 1.02, transition: { duration: 0.15 } }}
      className="relative rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-glass)] backdrop-blur-xl p-4 overflow-hidden group cursor-default"
    >
      {/* Ambient gradient orb */}
      <div
        className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-15 blur-2xl pointer-events-none group-hover:opacity-25 transition-opacity duration-300"
        style={{ background: orbGradient }}
      />

      {/* Header: icon + title */}
      <div className="flex items-center gap-2 mb-2">
        {icon && (
          <div className="w-6 h-6 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
            <span className="material-symbols-rounded text-[var(--icon-sm)] text-indigo-400">
              {icon}
            </span>
          </div>
        )}
        <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-[0.5px] font-medium">
          {(component.title as string) || "Metric"}
        </p>
      </div>

      {/* Value */}
      <p className="text-[22px] font-bold text-[var(--text-primary)] tracking-[-0.5px] tabular-nums">
        {component.value as string}
      </p>

      {/* Change indicator OR subtitle */}
      {component.change != null ? (
        <div className={`flex items-center gap-1 mt-1.5 ${changeColor}`}>
          <span className="material-symbols-rounded text-[var(--icon-sm)]">{changeIcon}</span>
          <span className="text-[11px] font-medium">{String(component.change)}</span>
        </div>
      ) : subtitle ? (
        <p className="text-[10px] text-[var(--text-muted)] mt-1.5">{subtitle}</p>
      ) : null}
    </motion.div>
  );
}

function GridLayout({ component }: { component: DashboardComponent }) {
  const columns = (component.columns as number) || 2;
  const children = (component.children as DashboardComponent[]) || [];

  return (
    <div>
      {component._title && (
        <div className="flex items-center gap-2 mb-2.5">
          <span className="material-symbols-rounded text-[var(--icon-sm)] text-indigo-400">
            grid_view
          </span>
          <p className="text-[12px] font-semibold text-[var(--text-primary)]">
            {component._title}
          </p>
        </div>
      )}
      <motion.div
        className="grid gap-2.5"
        style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {children.map((child, i) => (
          <motion.div key={i} variants={itemVariants}>
            <ComponentRenderer component={child} />
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

function TextBlock({ component }: { component: DashboardComponent }) {
  const icon = component.icon as string;

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-glass)] backdrop-blur-xl p-4">
      <div className="flex items-start gap-2.5">
        {icon && (
          <div className="w-6 h-6 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0 mt-0.5">
            <span className="material-symbols-rounded text-[var(--icon-sm)] text-amber-400">
              {icon}
            </span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          {component._title && (
            <p className="text-[12px] font-semibold text-[var(--text-primary)] mb-1.5">
              {component._title}
            </p>
          )}
          <p className="text-[12px] text-[var(--text-secondary)] leading-[1.65]">
            {component.content as string}
          </p>
        </div>
      </div>
    </div>
  );
}
