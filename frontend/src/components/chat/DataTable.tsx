interface Props {
  columns: string[];
  rows: any[][];
}

export function DataTable({ columns, rows }: Props) {
  return (
    <div className="overflow-x-auto my-2 rounded-[var(--radius-sm)] border border-[var(--border)]">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-[var(--border-strong)]">
            {columns.map((col) => (
              <th
                key={col}
                className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.6px] text-[var(--text-muted)] bg-[var(--surface-3)] whitespace-nowrap"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--surface-3)] transition-colors duration-75"
            >
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-1.5 text-[12px] font-mono tabular-nums text-[var(--text-primary)]">
                  {cell === null ? (
                    <span className="text-[var(--text-muted)] italic not-italic">null</span>
                  ) : (
                    String(cell)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
