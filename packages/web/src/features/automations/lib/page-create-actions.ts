import { create } from 'zustand';

export const useAutomationsPageCreateActions =
  create<AutomationsPageCreateActionsState>((set) => ({
    actions: null,
    register: (actions) => set({ actions }),
    unregister: (actions) =>
      set((state) => (state.actions === actions ? { actions: null } : state)),
  }));

export type AutomationsPageCreateActions = {
  createFolder: () => void;
  importFlow: () => void;
  importTable: () => void;
};

type AutomationsPageCreateActionsState = {
  actions: AutomationsPageCreateActions | null;
  register: (actions: AutomationsPageCreateActions) => void;
  unregister: (actions: AutomationsPageCreateActions) => void;
};
