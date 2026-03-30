interface Props {
  columns: string[];
  rows: any[][];
}

export function DataTable({ columns, rows }: Props) {
  return (
    <div className="overflow-x-auto my-2">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-[var(--border)]">
            {columns.map((col) => (
              <th
                key={col}
                className="px-3 py-2 text-left font-medium text-[var(--muted-foreground)]"
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
              className="border-b border-[var(--border)] hover:bg-[var(--secondary)]"
            >
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-1.5 text-[var(--foreground)]">
                  {cell === null ? (
                    <span className="text-[var(--muted-foreground)] italic">null</span>
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
