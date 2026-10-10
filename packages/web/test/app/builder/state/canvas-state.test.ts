// @vitest-environment jsdom
import {
  FlowTriggerType,
  FlowVersion,
  FlowVersionState,
} from '@activepieces/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createCanvasState } from '@/app/builder/state/canvas-state';

vi.mock('@/features/flow-runs', () => ({
  flowRunUtils: {
    findLastStepWithStatus: () => null,
  },
}));

describe('createCanvasState', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('has no orientation, panning or minimap preference', () => {
    localStorage.setItem('ap.builder.canvasOrientation', 'vertical');
    localStorage.setItem('defaultPanningMode', 'grab');
    const state = createCanvasState(
      {
        readonly: false,
        hideTestWidget: false,
        run: null,
        flowVersion: createFlowVersion(),
      },
      vi.fn(),
    );
    expect(Object.keys(state)).not.toContain('canvasOrientation');
    expect(Object.keys(state)).not.toContain('panningMode');
    expect(Object.keys(state)).not.toContain('showMinimap');
    expect(Object.keys(state)).not.toContain('setCanvasOrientation');
  });

  it('records a step test request from the canvas and clears it', () => {
    const set = vi.fn();
    const state = createCanvasState(
      {
        readonly: false,
        hideTestWidget: false,
        run: null,
        flowVersion: createFlowVersion(),
      },
      set,
    );
    expect(state.stepTestRequest).toBeNull();
    state.requestStepTest('step_1');
    expect(set).toHaveBeenLastCalledWith({ stepTestRequest: 'step_1' });
    state.clearStepTestRequest();
    expect(set).toHaveBeenLastCalledWith({ stepTestRequest: null });
  });
});

function createFlowVersion(): FlowVersion {
  return {
    id: 'version-id',
    created: '2026-01-01T00:00:00.000Z',
    updated: '2026-01-01T00:00:00.000Z',
    flowId: 'flow-id',
    displayName: 'Test flow',
    trigger: {
      name: 'trigger',
      valid: false,
      displayName: 'Select Trigger',
      type: FlowTriggerType.EMPTY,
      settings: {},
      lastUpdatedDate: '2026-01-01T00:00:00.000Z',
    },
    updatedBy: null,
    valid: false,
    schemaVersion: null,
    agentIds: [],
    state: FlowVersionState.DRAFT,
    connectionIds: [],
    backupFiles: null,
    notes: [],
    stepPositions: {},
  };
}
