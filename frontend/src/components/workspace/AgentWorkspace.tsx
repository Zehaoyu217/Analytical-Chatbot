import { useChatStore } from "@/stores/chatStore";
import { DashboardRenderer } from "./DashboardRenderer";

export function AgentWorkspace() {
  const dashboardComponents = useChatStore((s) => s.dashboardComponents);

  if (dashboardComponents.length === 0) {
    return (
      <div className="px-3.5 py-5 flex-1">
        <p className="text-[10px] font-mono text-[var(--text-dim)]">
          canvas empty — ask the agent to "build a dashboard"
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
