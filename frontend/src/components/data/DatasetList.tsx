import { useRef, useState } from "react";
import { useDatasets, useDeleteDataset } from "@/hooks/useDatasets";
import { funText } from "@/lib/funText";
import { motion, AnimatePresence } from "framer-motion";

export function DatasetList() {
  const { data: datasets, isLoading } = useDatasets();
  const { mutate: remove } = useDeleteDataset();
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDelete = (tableName: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setPendingDelete(tableName);
    timeoutRef.current = setTimeout(() => {
      remove(tableName);
      setPendingDelete(null);
    }, 5000);
  };

  const handleUndo = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setPendingDelete(null);
  };

  return (
    <div>
      {isLoading && (
        <p className="text-[11px] text-[var(--text-muted)] px-2 mt-2">Loading...</p>
      )}

      {datasets?.length === 0 && !pendingDelete && (
        <p className="text-[11px] text-[var(--text-muted)] px-2 mt-2">
          {funText.noDatasets}
        </p>
      )}

      <div className="mt-1.5 space-y-0.5">
        {datasets
          ?.filter((ds: any) => ds.table_name !== pendingDelete)
          .map((ds: any) => (
            <div
              key={ds.table_name}
              className="group flex items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 cursor-default transition-colors duration-100 hover:bg-[var(--surface-3)]"
            >
              <span className="material-symbols-rounded text-[14px] text-emerald-400/70 shrink-0">
                table_chart
              </span>

              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-mono font-medium text-[var(--text-primary)] truncate">
                  {ds.table_name}
                </p>
                <p className="text-[9px] font-mono text-[var(--text-dim)]">
                  {ds.row_count?.toLocaleString()} rows · {ds.column_count} cols
                </p>
              </div>

              <button
                onClick={() => handleDelete(ds.table_name)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded-[var(--radius-sm)] hover:bg-red-500/10 text-[var(--text-dim)] hover:text-red-400 transition-all duration-100"
                title="Delete dataset"
              >
                <span className="material-symbols-rounded text-[13px]">
                  close
                </span>
              </button>
            </div>
          ))}
      </div>

      {/* Undo toast */}
      <AnimatePresence>
        {pendingDelete && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="mx-1 mt-2 flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-[var(--radius-sm)] bg-rose-500/8 border border-rose-500/20"
          >
            <p className="text-[11px] text-rose-400/80 truncate min-w-0">
              <span className="font-mono">{pendingDelete}</span> deleted
            </p>
            <button
              onClick={handleUndo}
              className="shrink-0 text-[11px] font-medium text-rose-400 hover:text-rose-300 transition-colors"
            >
              Undo
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
