import { ProgressPanel } from "./ProgressPanel";
import { ArtifactsPanel } from "./ArtifactsPanel";

export function ProgressAndArtifacts() {
  return (
    <div className="flex flex-col h-full">
      {/* Upper: Progress */}
      <div className="flex-1 min-h-0 overflow-y-auto border-b border-[var(--border)]">
        <ProgressPanel />
      </div>

      {/* Lower: Artifacts */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <ArtifactsPanel />
      </div>
    </div>
  );
}
