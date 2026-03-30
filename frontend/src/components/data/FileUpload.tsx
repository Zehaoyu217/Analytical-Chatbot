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
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex flex-col items-center gap-1.5 rounded-[var(--radius-md)] border-2 border-dashed p-4 cursor-pointer transition-all duration-150
          ${
            dragOver
              ? "border-[var(--border-accent)] bg-gradient-to-b from-indigo-500/5 to-transparent"
              : "border-[var(--border-strong)] hover:border-[var(--border-accent)] hover:bg-gradient-to-b hover:from-indigo-500/5 hover:to-transparent"
          }
          ${isPending ? "opacity-50 pointer-events-none" : ""}
        `}
      >
        {isPending ? (
          <>
            <div className="w-8 h-8 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
            <span className="text-[12px] font-medium text-[var(--text-secondary)]">
              {funText.uploadingText}
            </span>
          </>
        ) : (
          <>
            <span className="material-symbols-rounded text-[var(--icon-xl)] text-[var(--text-muted)]">
              upload_file
            </span>
            <div className="text-center">
              <p className="text-[12px] font-medium text-[var(--text-secondary)]">
                {funText.uploadText}
              </p>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                {funText.uploadSubtext}
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
