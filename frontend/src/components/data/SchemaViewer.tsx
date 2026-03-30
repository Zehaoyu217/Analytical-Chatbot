import type { ColumnDef } from "@/types";

interface Props {
  tableName: string;
  columns: ColumnDef[];
}

export function SchemaViewer({ tableName, columns }: Props) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border)] overflow-hidden">
      <div className="bg-[var(--surface-3)] px-3 py-2">
        <span className="text-[12px] font-medium text-[var(--text-primary)]">{tableName}</span>
      </div>
      <div className="divide-y divide-[var(--border)]">
        {columns.map((col) => (
          <div key={col.name} className="flex items-center justify-between px-3 py-1.5">
            <span className="text-[12px] text-[var(--text-secondary)]">{col.name}</span>
            <span className="text-[10px] text-[var(--text-muted)] font-mono">
              {col.type}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
