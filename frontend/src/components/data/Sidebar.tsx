import { FileUpload } from "./FileUpload";
import { DatasetList } from "./DatasetList";
import { ModelSelector } from "@/components/settings/ModelSelector";

export function Sidebar() {
  return (
    <aside className="w-72 border-r border-[var(--border)] flex flex-col bg-[var(--background)] shrink-0">
      <div className="p-4 border-b border-[var(--border)]">
        <ModelSelector />
      </div>

      <div className="p-4 border-b border-[var(--border)]">
        <FileUpload />
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <DatasetList />
      </div>
    </aside>
  );
}
