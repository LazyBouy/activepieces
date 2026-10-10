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

  it('always lays the canvas out left to right', () => {
    const state = createCanvasState(
      {
        readonly: false,
        hideTestWidget: false,
        run: null,
        flowVersion: createFlowVersion(),
      },
      vi.fn(),
    );
    expect(state.canvasOrientation).toBe('horizontal');
  });

  it('ignores the old stored orientation and panning preferences', () => {
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
    expect(state.canvasOrientation).toBe('horizontal');
    expect(Object.keys(state)).not.toContain('panningMode');
    expect(Object.keys(state)).not.toContain('showMinimap');
    expect(Object.keys(state)).not.toContain('setCanvasOrientation');
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
  };
}
