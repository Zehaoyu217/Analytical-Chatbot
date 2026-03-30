import { create } from "zustand";

interface SettingsState {
  provider: string;
  model: string;
  sidebarOpen: boolean;
  setProvider: (provider: string) => void;
  setModel: (model: string) => void;
  toggleSidebar: () => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  provider: "openrouter",
  model: "openai/gpt-oss-120b:free",
  sidebarOpen: true,

  setProvider: (provider) => set({ provider }),
  setModel: (model) => set({ model }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}));
