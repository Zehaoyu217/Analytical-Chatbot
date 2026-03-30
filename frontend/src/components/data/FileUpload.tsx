import { useRef, useState, type DragEvent } from "react";
import { useUpload } from "@/hooks/useDatasets";
import { funText } from "@/lib/funText";

export function FileUpload() {
  const { mutate: upload, isPending } = useUpload();
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files?.length) return;
    upload(files[0]);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload data file — CSV, Excel, TSV, or Parquet"
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={`flex items-center gap-2.5 rounded-[var(--radius-sm)] border border-dashed px-3 py-2.5 cursor-pointer transition-all duration-150
          ${
            dragOver
              ? "border-[var(--border-accent)] bg-amber-500/5"
              : "border-[var(--border-strong)] hover:border-[var(--border-accent)] hover:bg-amber-500/3"
          }
          ${isPending ? "opacity-50 pointer-events-none" : ""}
        `}
      >
        {isPending ? (
          <>
            <div className="w-5 h-5 rounded-full border-[1.5px] border-amber-400 border-t-transparent animate-spin shrink-0" />
            <span className="text-[11px] font-mono text-[var(--text-secondary)]">
              {funText.uploadingText}
            </span>
          </>
        ) : (
          <>
            <span className="material-symbols-rounded text-[var(--icon-lg)] text-[var(--text-muted)]">
              upload_file
            </span>
            <div>
              <p className="text-[11px] font-medium text-[var(--text-secondary)]">
                {funText.uploadText}
              </p>
              <p className="text-[10px] text-[var(--text-dim)] mt-0.5 font-mono">
                csv · xlsx · tsv · parquet
              </p>
            </div>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls,.tsv,.parquet"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
