/**
 * @vitest-environment jsdom
 */
import {
  FlowRun,
  FlowRunStatus,
  RunEnvironment,
} from '@activepieces/shared';
import { QueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BuilderStore, createBuilderStore } from '@/app/builder/builder-hooks';

import { code, createTestBuilderStore, pieceTrigger } from './builder-store-fixtures';

function buildRun(id: string): FlowRun {
  const now = '2026-01-01T00:00:00.000Z';
  return {
    id,
    created: now,
    updated: now,
    projectId: 'project-1',
    flowId: 'flow-1',
    flowVersionId: 'version-1',
    status: FlowRunStatus.RUNNING,
    environment: RunEnvironment.TESTING,
    steps: {},
    tags: [],
    startTime: now,
    failParentOnFailure: false,
    logsFileId: null,
    archivedAt: null,
  };
}

function storeWithInitialRun(run: FlowRun): BuilderStore {
  const base = createTestBuilderStore({ trigger: pieceTrigger(code({ name: 'step_1' })) });
  const { flow, flowVersion } = base.getState();
  return createBuilderStore({
    flow,
    flowVersion,
    readonly: true,
    hideTestWidget: false,
    run,
    outputSampleData: {},
    inputSampleData: {},
    socket: io('http://localhost', { autoConnect: false }),
    queryClient: new QueryClient(),
  });
}

function newStore(): BuilderStore {
  return createTestBuilderStore({
    trigger: pieceTrigger(code({ name: 'step_1' })),
  });
}

describe('logs panel state', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('starts collapsed when nothing is saved and no run is open', () => {
    const store = newStore();
    expect(store.getState().isLogsPanelOpen).toBe(false);
    expect(store.getState().isRunOpenedFromList).toBe(false);
    expect(store.getState().logsPanes).toEqual({ input: false, output: true });
  });

  it('restores the saved open state', () => {
    window.localStorage.setItem('ap.builder.logsPanelOpen', 'true');
    expect(newStore().getState().isLogsPanelOpen).toBe(true);
  });

  it('opens by default for a run opened from the runs list', () => {
    window.localStorage.setItem('ap.builder.logsPanelOpen', 'false');
    const store = storeWithInitialRun(buildRun('run-1'));
    expect(store.getState().isLogsPanelOpen).toBe(true);
    expect(store.getState().isRunOpenedFromList).toBe(true);
  });

  it('persists open and closed through the setter and the toggle', () => {
    const store = newStore();
    store.getState().setLogsPanelOpen(true);
    expect(window.localStorage.getItem('ap.builder.logsPanelOpen')).toBe(
      'true',
    );
    store.getState().toggleLogsPanel();
    expect(store.getState().isLogsPanelOpen).toBe(false);
    expect(window.localStorage.getItem('ap.builder.logsPanelOpen')).toBe(
      'false',
    );
  });

  it('opens when a new test run starts and never closes on its own', () => {
    const store = newStore();
    const run = buildRun('run-1');
    store.getState().setRun(run, store.getState().flowVersion);
    expect(store.getState().isLogsPanelOpen).toBe(true);
    store.getState().setLogsPanelOpen(false);
    store
      .getState()
      .setRun(
        { ...run, status: FlowRunStatus.SUCCEEDED },
        store.getState().flowVersion,
      );
    expect(store.getState().isLogsPanelOpen).toBe(false);
    store.getState().setRun(buildRun('run-2'), store.getState().flowVersion);
    expect(store.getState().isLogsPanelOpen).toBe(true);
  });

  it('never hides the last visible pane', () => {
    const store = newStore();
    store.getState().toggleLogsPane('output');
    expect(store.getState().logsPanes).toEqual({ input: false, output: true });
    store.getState().toggleLogsPane('input');
    store.getState().toggleLogsPane('output');
    expect(store.getState().logsPanes).toEqual({ input: true, output: false });
  });

  it('still works when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const store = newStore();
    expect(store.getState().isLogsPanelOpen).toBe(false);
    expect(() => store.getState().setLogsPanelOpen(true)).not.toThrow();
    expect(store.getState().isLogsPanelOpen).toBe(true);
  });
});
