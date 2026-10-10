// @vitest-environment jsdom
import {
  FlowOperationType,
  flowLayoutUtil,
  flowOperations,
  FlowTrigger,
  FlowVersion,
  FlowVersionState,
  StepLocationRelativeToParent,
  StepPositions,
} from '@activepieces/shared';
import { describe, expect, it } from 'vitest';

import { flowCanvasUtils } from '@/app/builder/flow-canvas/utils/flow-canvas-utils';
import { stepPositionUtils } from '@/app/builder/flow-canvas/utils/step-position-utils';
import { ApButtonData } from '@/app/builder/flow-canvas/utils/types';

import { code, pieceTrigger, router } from '../../state/builder-store-fixtures';

describe('stepPositionUtils.getDropTargets', () => {
  it('offers every edge and stub except the dragged step’s own edges', () => {
    const trigger = branchingTrigger();

    const targets = dropTargetsFor({ trigger, draggedStepName: 'step_2' });

    expect(targets).toEqual([
      { id: 'trigger-out-0-edge', location: after('trigger') },
      { id: 'step_3-out-0-edge', location: after('step_3') },
      {
        id: 'step_1-out-1-edge',
        location: {
          parentStepName: 'step_1',
          stepLocationRelativeToParent:
            StepLocationRelativeToParent.INSIDE_BRANCH,
          branchIndex: 1,
        },
      },
      { id: 'step_1-join-out-edge', location: after('step_1') },
      { id: 'step_4-out-0', location: after('step_4') },
    ]);
  });

  it('excludes the descendants of a dragged router', () => {
    const targets = dropTargetsFor({
      trigger: branchingTrigger(),
      draggedStepName: 'step_1',
    });

    expect(targets.map((target) => target.id)).toEqual(['step_4-out-0']);
  });

  it('offers no targets for the trigger', () => {
    expect(
      dropTargetsFor({
        trigger: branchingTrigger(),
        draggedStepName: 'trigger',
      }),
    ).toEqual([]);
  });
});

describe('stepPositionUtils.getDropTargetState', () => {
  const stepDrag = {
    targets: [{ id: 'step_1-out-0-edge', location: after('step_1') }],
    active: true,
  };

  it('arms the target under the pointer and dims the others', () => {
    expect(
      stepPositionUtils.getDropTargetState({
        stepDrag,
        dropTargetId: 'step_1-out-0-edge',
        id: 'step_1-out-0-edge',
      }),
    ).toBe('armed');
    expect(
      stepPositionUtils.getDropTargetState({
        stepDrag,
        dropTargetId: null,
        id: 'step_1-out-0-edge',
      }),
    ).toBe('idle');
  });

  it('shows nothing for ineligible targets and fades after the drop', () => {
    expect(
      stepPositionUtils.getDropTargetState({
        stepDrag,
        dropTargetId: null,
        id: 'step_2-out-0',
      }),
    ).toBe('none');
    expect(
      stepPositionUtils.getDropTargetState({
        stepDrag: { ...stepDrag, active: false },
        dropTargetId: null,
        id: 'step_1-out-0-edge',
      }),
    ).toBe('fading');
  });
});

describe('stepPositionUtils.computeInsertFollowUp', () => {
  it('pushes the step after a router when its branch grows past the join', () => {
    const trigger = branchingTrigger();
    const stepPositions = flowLayoutUtil.computeAutoLayout({ trigger }).steps;
    const previousVersion = createFlowVersion({ trigger, stepPositions });
    const currentVersion = flowOperations.apply(previousVersion, {
      type: FlowOperationType.ADD_ACTION,
      request: {
        parentStep: 'step_3',
        stepLocationRelativeToParent: StepLocationRelativeToParent.AFTER,
        action: code({ name: 'step_5' }),
      },
    });

    const positions = stepPositionUtils.computeInsertFollowUp({
      previousVersion,
      currentVersion,
      movedNames: [],
      overrides: {},
    });

    expect(positions).toEqual({
      step_5: {
        x: stepPositions.step_3.x + flowLayoutUtil.constants.PITCH,
        y: stepPositions.step_3.y,
      },
      step_4: {
        x: stepPositions.step_4.x + flowLayoutUtil.constants.PITCH,
        y: stepPositions.step_4.y,
      },
    });
  });

  it('moves a re-parented subtree with its head', () => {
    const trigger = pieceTrigger(
      router({
        name: 'step_1',
        branches: [code({ name: 'step_2' }), null],
        next: router({
          name: 'step_3',
          branches: [code({ name: 'step_4' }), null],
        }),
      }),
    );
    const stepPositions = flowLayoutUtil.computeAutoLayout({ trigger }).steps;
    const previousVersion = createFlowVersion({ trigger, stepPositions });
    const currentVersion = flowOperations.apply(previousVersion, {
      type: FlowOperationType.MOVE_ACTION,
      request: {
        name: 'step_3',
        newParentStep: 'step_1',
        stepLocationRelativeToNewParent:
          StepLocationRelativeToParent.INSIDE_BRANCH,
        branchIndex: 1,
      },
    });
    const drop = { x: 640, y: 640 };

    const positions = stepPositionUtils.computeInsertFollowUp({
      previousVersion,
      currentVersion,
      movedNames: ['step_3', 'step_4'],
      overrides: { step_3: drop },
    });

    expect(positions.step_3).toEqual(drop);
    expect(positions.step_4).toEqual({
      x: stepPositions.step_4.x + drop.x - stepPositions.step_3.x,
      y: stepPositions.step_4.y + drop.y - stepPositions.step_3.y,
    });
  });
});

function dropTargetsFor({
  trigger,
  draggedStepName,
}: {
  trigger: FlowTrigger;
  draggedStepName: string;
}) {
  const graph = flowCanvasUtils.createFlowGraph({
    version: createFlowVersion({ trigger, stepPositions: {} }),
    notes: [],
    readonly: false,
  });
  return stepPositionUtils.getDropTargets({ graph, trigger, draggedStepName });
}

function branchingTrigger(): FlowTrigger {
  return pieceTrigger(
    router({
      name: 'step_1',
      branches: [
        code({ name: 'step_2', next: code({ name: 'step_3' }) }),
        null,
      ],
      next: code({ name: 'step_4' }),
    }),
  );
}

function after(parentStepName: string): ApButtonData {
  return {
    parentStepName,
    stepLocationRelativeToParent: StepLocationRelativeToParent.AFTER,
  };
}

function createFlowVersion({
  trigger,
  stepPositions,
}: {
  trigger: FlowTrigger;
  stepPositions: StepPositions;
}): FlowVersion {
  return {
    id: 'version-id',
    created: NOW,
    updated: NOW,
    flowId: 'flow-id',
    displayName: 'Test flow',
    trigger,
    updatedBy: null,
    valid: true,
    schemaVersion: null,
    agentIds: [],
    state: FlowVersionState.DRAFT,
    connectionIds: [],
    backupFiles: null,
    notes: [],
    stepPositions,
  };
}

const NOW = '2026-01-01T00:00:00.000Z';
