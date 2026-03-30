import { ModelSelector } from "./ModelSelector";

export function SettingsPanel() {
  return (
    <div className="space-y-4 p-4">
      <h2 className="text-sm font-semibold">Settings</h2>
      <ModelSelector />
    </div>
  );
}
