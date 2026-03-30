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
  visible: { transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.22, ease: "easeOut" as const } },
};

export function DashboardRenderer({ components, artifacts }: Props) {
  return (
    <motion.div
      className="space-y-2"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {components.map((comp, i) => (
        <motion.div key={`comp-${i}`} variants={itemVariants}>
          <ComponentRenderer component={comp} />
        </motion.div>
      ))}

      {artifacts
        .filter((a) => a.type === "chart" || a.type === "table")
        .map((artifact) => (
          <motion.div
            key={artifact.id}
            variants={itemVariants}
            className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-2)] overflow-hidden"
          >
            {artifact.title && (
              <div className="px-3 py-2 border-b border-[var(--border)] flex items-center gap-2 bg-[var(--surface-3)]">
                <span className="material-symbols-rounded text-[12px] text-[var(--text-muted)]">
                  {artifact.type === "chart" ? "bar_chart" : "table_chart"}
                </span>
                <span className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-[0.4px]">
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

/** Renders a single dashboard component — exported for use in MessageBubble */
export function ComponentRenderer({ component }: { component: DashboardComponent }) {
  switch (component.type) {
    case "metric":
      return <MetricCard component={component} />;
    case "grid":
      return <GridLayout component={component} />;
    case "text":
      return <TextBlock component={component} />;
    case "progress":
      return <ProgressBar component={component} />;
    case "divider":
      return <Divider component={component} />;
    case "alert":
      return <AlertBlock component={component} />;
    case "comparison":
      return <ComparisonCard component={component} />;
    case "list":
      return <ListBlock component={component} />;
    case "cols_2":
      return <TwoColumnLayout component={component} />;
    case "table":
      return <InlineTable component={component} />;
    default:
      return (
        <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-2)] p-3">
          <pre className="text-[11px] text-[var(--text-muted)] overflow-auto font-mono">
            {JSON.stringify(component, null, 2)}
          </pre>
        </div>
      );
  }
}

/* ── Shared helpers ──────────────────────────────────────────── */

function changeStyles(changeType: string) {
  return {
    text: changeType === "positive" ? "text-emerald-400"
        : changeType === "negative" ? "text-rose-400"
        : "text-[var(--text-muted)]",
    bg:   changeType === "positive" ? "bg-emerald-500/10"
        : changeType === "negative" ? "bg-rose-500/10"
        : "bg-white/5",
    arrow: changeType === "positive" ? "▲"
         : changeType === "negative" ? "▼"
         : "—",
    icon: changeType === "positive" ? "trending_up"
        : changeType === "negative" ? "trending_down"
        : "remove",
  };
}

/* ── MetricCard ─────────────────────────────────────────────── */
function MetricCard({ component }: { component: DashboardComponent }) {
  const changeType = component.changeType as string;
  const icon = component.icon as string;
  const subtitle = component.subtitle as string;
  const { text: changeText, bg: changeBg, arrow } = changeStyles(changeType);

  return (
    <motion.div
      whileHover={{ backgroundColor: "rgba(255,255,255,0.015)" }}
      className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 cursor-default transition-colors duration-150"
    >
      {/* Label row */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-[1.1px] flex items-center gap-1">
          {icon && (
            <span className="material-symbols-rounded text-[11px] align-middle opacity-60">{icon}</span>
          )}
          {(component.title as string) || "Metric"}
        </p>
        {component.change != null && (
          <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${changeBg} ${changeText} tabular-nums`}>
            {arrow} {String(component.change)}
          </span>
        )}
      </div>

      {/* Primary value */}
      <p className="text-[28px] font-black text-[var(--text-primary)] tracking-[-1.5px] tabular-nums leading-none font-mono">
        {component.value as string}
      </p>

      {/* Subtitle */}
      {subtitle && (
        <p className="text-[10px] text-[var(--text-muted)] mt-1.5 font-mono tracking-tight">{subtitle}</p>
      )}
    </motion.div>
  );
}

/* ── GridLayout ─────────────────────────────────────────────── */
function GridLayout({ component }: { component: DashboardComponent }) {
  const columns = (component.columns as number) || 2;
  const children = (component.children as DashboardComponent[]) || [];

  return (
    <div>
      {component._title && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-[1.1px]">
            {component._title}
          </span>
          <div className="flex-1 h-px bg-[var(--border)]" />
        </div>
      )}
      <motion.div
        className="grid gap-2"
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

/* ── TextBlock ─────────────────────────────────────────────── */
function TextBlock({ component }: { component: DashboardComponent }) {
  const icon = component.icon as string;

  return (
    <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5">
      <div className="flex items-start gap-2">
        {icon && (
          <span className="material-symbols-rounded text-[14px] text-amber-400 mt-0.5 shrink-0 opacity-80">{icon}</span>
        )}
        <div className="flex-1 min-w-0">
          {component._title && (
            <p className="text-[11px] font-semibold text-[var(--text-primary)] mb-1">
              {component._title}
            </p>
          )}
          <p className="text-[12px] text-[var(--text-secondary)] leading-[1.6]">
            {component.content as string}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── ProgressBar ─────────────────────────────────────────────── */
function ProgressBar({ component }: { component: DashboardComponent }) {
  const value = (component.value as number) ?? 0;
  const max = (component.max as number) || 100;
  const changeType = component.changeType as string;
  const pct = Math.min(100, Math.max(0, (value / max) * 100));

  const barColor = changeType === "positive" ? "bg-emerald-500"
                 : changeType === "negative" ? "bg-rose-500"
                 : "bg-amber-500";

  const textColor = changeType === "positive" ? "text-emerald-400"
                  : changeType === "negative" ? "text-rose-400"
                  : "text-amber-400";

  return (
    <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-[1.1px]">
          {(component.title as string) || "Progress"}
        </p>
        <span className={`text-[12px] font-black tabular-nums font-mono ${textColor}`}>
          {pct.toFixed(0)}%
        </span>
      </div>
      {/* Track */}
      <div className="h-[3px] rounded-none bg-white/5 overflow-hidden">
        <motion.div
          className={`h-full w-full relative overflow-hidden ${barColor}`}
          style={{ transformOrigin: "left center" }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: pct / 100 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          {pct < 100 && (
            <div
              className="absolute inset-0 shimmer-bar opacity-30"
              style={{ background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)" }}
            />
          )}
        </motion.div>
      </div>
      {(component.subtitle as string | undefined) && (
        <p className="text-[10px] text-[var(--text-muted)] mt-1.5 font-mono">
          {component.subtitle as string}
        </p>
      )}
    </div>
  );
}

/* ── Divider ─────────────────────────────────────────────────── */
function Divider({ component }: { component: DashboardComponent }) {
  const title = (component.title as string) || (component._title as string);

  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="h-px flex-1 bg-[var(--border)]" />
      {title && (
        <>
          <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-[1.2px] shrink-0">
            {title}
          </span>
          <div className="h-px flex-1 bg-[var(--border)]" />
        </>
      )}
    </div>
  );
}

/* ── ComparisonCard ──────────────────────────────────────────── */
function ComparisonCard({ component }: { component: DashboardComponent }) {
  const changeType = component.changeType as string;
  const current = component.current as string;
  const prior = component.prior as string;
  const label = (component.label as string) || "vs prior";
  const { text: changeText, bg: changeBg, arrow } = changeStyles(changeType);

  return (
    <motion.div
      whileHover={{ backgroundColor: "rgba(255,255,255,0.015)" }}
      className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 cursor-default transition-colors duration-150"
    >
      <p className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-[1.1px] mb-2">
        {(component.title as string) || "Comparison"}
      </p>

      <div className="flex items-end gap-4">
        {/* Current */}
        <div>
          <p className="text-[9px] text-[var(--text-muted)] uppercase tracking-[0.6px] mb-0.5">Current</p>
          <p className="text-[26px] font-black text-[var(--text-primary)] tracking-[-1px] tabular-nums leading-none font-mono">
            {current}
          </p>
        </div>

        {/* Delta badge */}
        <span className={`text-[11px] font-mono font-semibold px-2 py-1 rounded ${changeBg} ${changeText} tabular-nums mb-1`}>
          {arrow}
        </span>

        {/* Prior */}
        <div>
          <p className="text-[9px] text-[var(--text-muted)] uppercase tracking-[0.6px] mb-0.5">Prior</p>
          <p className="text-[20px] font-bold text-[var(--text-secondary)] tracking-[-0.8px] tabular-nums leading-none font-mono">
            {prior}
          </p>
        </div>

        <div className="ml-auto self-end">
          <span className="text-[9px] text-[var(--text-muted)] font-mono uppercase tracking-[0.4px] bg-white/4 px-2 py-1 rounded">
            {label}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

/* ── ListBlock ───────────────────────────────────────────────── */
interface ListItem {
  label: string;
  value?: string;
  icon?: string;
}

function ListBlock({ component }: { component: DashboardComponent }) {
  const items = (component.items as ListItem[]) || [];
  const headerIcon = component.icon as string;
  const title = (component._title as string) || (component.title as string);

  return (
    <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-2)] overflow-hidden">
      {title && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)] bg-[var(--surface-3)]">
          {headerIcon && (
            <span className="material-symbols-rounded text-[12px] text-[var(--text-muted)] opacity-70">{headerIcon}</span>
          )}
          <p className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-[1.1px]">{title}</p>
        </div>
      )}

      <div>
        {items.map((item, i) => (
          <div
            key={i}
            className="flex items-center gap-2.5 px-3 py-2 border-b border-[var(--border)] last:border-b-0 hover:bg-white/[0.025] transition-colors duration-100"
          >
            {item.icon ? (
              <span className="material-symbols-rounded text-[12px] text-[var(--text-muted)] shrink-0 opacity-60">{item.icon}</span>
            ) : (
              <span className="text-[9px] font-mono text-[var(--text-muted)] shrink-0 w-4 tabular-nums opacity-50">{i + 1}</span>
            )}
            <span className="text-[12px] text-[var(--text-secondary)] flex-1 truncate">{item.label}</span>
            {item.value && (
              <span className="text-[12px] font-mono font-semibold text-[var(--text-primary)] tabular-nums shrink-0">
                {item.value}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── TwoColumnLayout ─────────────────────────────────────────── */
function TwoColumnLayout({ component }: { component: DashboardComponent }) {
  const left = component.left as DashboardComponent | undefined;
  const right = component.right as DashboardComponent | undefined;

  return (
    <div className="grid grid-cols-2 gap-2">
      {left && (
        <motion.div variants={itemVariants}>
          <ComponentRenderer component={left} />
        </motion.div>
      )}
      {right && (
        <motion.div variants={itemVariants}>
          <ComponentRenderer component={right} />
        </motion.div>
      )}
    </div>
  );
}

/* ── InlineTable ─────────────────────────────────────────────── */
function InlineTable({ component }: { component: DashboardComponent }) {
  const columns = (component.columns as string[]) || [];
  const rows = (component.rows as (string | number)[][]) || [];
  const title = (component._title as string) || (component.title as string);

  return (
    <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-2)] overflow-hidden">
      {title && (
        <div className="px-3 py-2 border-b border-[var(--border)] bg-[var(--surface-3)] flex items-center gap-2">
          <span className="material-symbols-rounded text-[12px] text-[var(--text-muted)]">table_chart</span>
          <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-[1.1px]">{title}</span>
        </div>
      )}
      <div className="overflow-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-[var(--border-strong)]">
              {columns.map((col, i) => (
                <th
                  key={i}
                  className="px-3 py-2 text-left text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.8px] whitespace-nowrap bg-[var(--surface-3)]"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr
                key={ri}
                className={`transition-colors duration-100 border-b border-[var(--border)] last:border-b-0 ${ri % 2 === 0 ? "bg-transparent" : "bg-white/[0.025]"} hover:bg-white/[0.04]`}
              >
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className="px-3 py-2 text-[var(--text-secondary)] tabular-nums whitespace-nowrap font-mono text-[11px]"
                  >
                    {String(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── AlertBlock ──────────────────────────────────────────────── */
function AlertBlock({ component }: { component: DashboardComponent }) {
  const severity = (component.severity as string) || "info";

  const styles = {
    info: {
      border: "border-blue-500/25",
      bg: "bg-blue-500/5",
      strip: "bg-blue-500",
      icon: "info",
      iconColor: "text-blue-400",
      titleColor: "text-blue-300",
    },
    warning: {
      border: "border-amber-500/25",
      bg: "bg-amber-500/5",
      strip: "bg-amber-500",
      icon: "warning",
      iconColor: "text-amber-400",
      titleColor: "text-amber-300",
    },
    critical: {
      border: "border-rose-500/25",
      bg: "bg-rose-500/5",
      strip: "bg-rose-500",
      icon: "error",
      iconColor: "text-rose-400",
      titleColor: "text-rose-300",
    },
  }[severity] ?? {
    border: "border-blue-500/25",
    bg: "bg-blue-500/5",
    strip: "bg-blue-500",
    icon: "info",
    iconColor: "text-blue-400",
    titleColor: "text-blue-300",
  };

  return (
    <div className={`rounded-[var(--radius-sm)] border ${styles.border} ${styles.bg} overflow-hidden flex`}>
      {/* Semantic severity strip */}
      <div className={`w-[3px] shrink-0 ${styles.strip} opacity-70`} />
      <div className="flex-1 px-3 py-2.5">
        <div className="flex items-start gap-2">
          <span className={`material-symbols-rounded text-[13px] ${styles.iconColor} mt-px shrink-0`}>
            {styles.icon}
          </span>
          <div className="flex-1 min-w-0">
            {(component.title as string | undefined) && (
              <p className={`text-[11px] font-semibold ${styles.titleColor} mb-0.5`}>
                {component.title as string}
              </p>
            )}
            {(component.content as string | undefined) && (
              <p className="text-[12px] text-[var(--text-secondary)] leading-[1.6]">
                {component.content as string}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
