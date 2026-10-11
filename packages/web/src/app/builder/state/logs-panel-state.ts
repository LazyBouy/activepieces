import { isNil } from '@activepieces/core-utils';
import { FlowRun } from '@activepieces/shared';
import { StoreApi } from 'zustand';

import { BuilderState } from '../builder-hooks';
import {
  DEFAULT_LOGS_PANES,
  LogsPanes,
  logsPanelLayoutUtils,
} from '../logs-panel/logs-panel-layout-utils';

export const createLogsPanelState = (
  initialState: LogsPanelInitialState,
  get: StoreApi<BuilderState>['getState'],
  set: StoreApi<BuilderState>['setState'],
): LogsPanelState => {
  return {
    isLogsPanelOpen:
      !isNil(initialState.run) || logsPanelLayoutUtils.readSavedOpen(),
    logsPanes: DEFAULT_LOGS_PANES,
    isRunOpenedFromList: !isNil(initialState.run),
    setLogsPanelOpen: (open: boolean) => {
      logsPanelLayoutUtils.saveOpen({ open });
      set({ isLogsPanelOpen: open });
    },
    toggleLogsPanel: () => {
      get().setLogsPanelOpen(!get().isLogsPanelOpen);
    },
    toggleLogsPane: (pane: keyof LogsPanes) =>
      set((state) => ({
        logsPanes: logsPanelLayoutUtils.togglePane({
          panes: state.logsPanes,
          pane,
        }),
      })),
  };
};

export type LogsPanelState = {
  isLogsPanelOpen: boolean;
  logsPanes: LogsPanes;
  isRunOpenedFromList: boolean;
  setLogsPanelOpen: (open: boolean) => void;
  toggleLogsPanel: () => void;
  toggleLogsPane: (pane: keyof LogsPanes) => void;
};

type LogsPanelInitialState = {
  run: FlowRun | null;
};
