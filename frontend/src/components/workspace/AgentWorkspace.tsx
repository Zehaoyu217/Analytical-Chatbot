import { useChatStore } from "@/stores/chatStore";
import { DashboardRenderer } from "./DashboardRenderer";
import { funText } from "@/lib/funText";

export function AgentWorkspace() {
  const dashboardComponents = useChatStore((s) => s.dashboardComponents);

  if (dashboardComponents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6">
        <span className="material-symbols-rounded text-[var(--icon-xl)] text-[var(--text-muted)] block mb-2 opacity-40">
          dashboard
        </span>
        <p className="text-[12px] text-[var(--text-muted)] text-center">
          {funText.workspaceEmpty}
        </p>
      </div>
    );
  }

  return (
    <div className="p-3">
      <DashboardRenderer components={dashboardComponents} artifacts={[]} />
    </div>
  );
}
