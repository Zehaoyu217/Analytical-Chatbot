import type { ColumnDef } from "@/types";

interface Props {
  tableName: string;
  columns: ColumnDef[];
}

export function SchemaViewer({ tableName, columns }: Props) {
  return (
    <div className="rounded-lg border border-[var(--border)] overflow-hidden">
      <div className="bg-[var(--secondary)] px-3 py-2">
        <span className="text-xs font-medium">{tableName}</span>
      </div>
      <div className="divide-y divide-[var(--border)]">
        {columns.map((col) => (
          <div key={col.name} className="flex items-center justify-between px-3 py-1.5">
            <span className="text-xs text-[var(--foreground)]">{col.name}</span>
            <span className="text-[10px] text-[var(--muted-foreground)] font-mono">
              {col.type}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
