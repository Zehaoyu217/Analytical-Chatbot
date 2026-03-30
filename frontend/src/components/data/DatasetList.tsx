import { useDatasets, useDeleteDataset } from "@/hooks/useDatasets";
import { funText } from "@/lib/funText";

export function DatasetList() {
  const { data: datasets, isLoading } = useDatasets();
  const { mutate: remove } = useDeleteDataset();

  return (
    <div>
      {isLoading && (
        <p className="text-[11px] text-[var(--text-muted)] px-2 mt-2">Loading...</p>
      )}

      {datasets?.length === 0 && (
        <p className="text-[11px] text-[var(--text-muted)] px-2 mt-2">
          {funText.noDatasets}
        </p>
      )}

      <div className="mt-1.5 space-y-0.5">
        {datasets?.map((ds: any) => (
          <div
            key={ds.table_name}
            className="group flex items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 py-2 cursor-default transition-colors duration-100 hover:bg-[var(--surface-3)]"
          >
            {/* Icon Badge */}
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
              <span className="material-symbols-rounded text-[var(--icon-sm)] text-emerald-400">
                table_chart
              </span>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium text-[var(--text-primary)] truncate">
                {ds.table_name}
              </p>
              <p className="text-[10px] text-[var(--text-muted)]">
                {ds.row_count?.toLocaleString()} rows &middot; {ds.column_count} cols
              </p>
            </div>

            {/* Delete Button */}
            <button
              onClick={() => remove(ds.table_name)}
              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-[var(--radius-sm)] hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 transition-all duration-100"
              title="Delete dataset"
            >
              <span className="material-symbols-rounded text-[var(--icon-sm)]">
                delete
              </span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
