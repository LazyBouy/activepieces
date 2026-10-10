import { isNil } from '@activepieces/core-utils';
import {
  FlowOperationRequest,
  FlowOperationType,
  FlowVersion,
  StepCanvasPosition,
  StepLocationRelativeToParent,
  StepPositions,
  flowStructureUtil,
} from '@activepieces/shared';
import { StoreApi } from 'zustand';

import { BuilderState } from '../builder-hooks';
import { stepPositionUtils } from '../flow-canvas/utils/step-position-utils';
import { ApButtonData, ApDropTarget } from '../flow-canvas/utils/types';

export const createLayoutState = (
  get: StoreApi<BuilderState>['getState'],
  set: StoreApi<BuilderState>['setState'],
): LayoutState => {
  let pendingFollowUp: PendingFollowUp | null = null;
  let pendingMove: PendingMove | null = null;
  let stepDragClearTimeout: ReturnType<typeof setTimeout> | null = null;

  const applyStepPositions = (positions: StepPositions) => {
    if (Object.keys(positions).length === 0) {
      return;
    }
    get().applyOperation({
      type: FlowOperationType.UPDATE_STEP_POSITIONS,
      request: { positions },
    });
  };

  const flushInsertFollowUp = () => {
    const followUp = pendingFollowUp;
    pendingFollowUp = null;
    const { flowVersion, readonly } = get();
    if (isNil(followUp) || readonly) {
      return;
    }
    applyStepPositions(
      stepPositionUtils.computeInsertFollowUp({
        previousVersion: followUp.previousVersion,
        currentVersion: flowVersion,
        movedNames: followUp.movedNames,
        overrides: followUp.overrides,
      }),
    );
  };

  const clearPendingStepDragTimeout = () => {
    if (!isNil(stepDragClearTimeout)) {
      clearTimeout(stepDragClearTimeout);
      stepDragClearTimeout = null;
    }
  };

  return {
    stepDrag: null,
    dropTargetId: null,
    pendingStepPosition: null,
    startStepDrag: ({ stepName, targets }) => {
      clearPendingStepDragTimeout();
      set({
        stepDrag: { stepName, targets, active: true },
        dropTargetId: null,
      });
    },
    setDropTargetId: (dropTargetId) => {
      if (get().dropTargetId !== dropTargetId) {
        set({ dropTargetId });
      }
    },
    endStepDrag: () => {
      const { stepDrag } = get();
      if (isNil(stepDrag)) {
        return;
      }
      set({ stepDrag: { ...stepDrag, active: false }, dropTargetId: null });
      clearPendingStepDragTimeout();
      stepDragClearTimeout = setTimeout(() => {
        stepDragClearTimeout = null;
        if (get().stepDrag?.active === false) {
          set({ stepDrag: null });
        }
      }, DROP_TARGET_FADE_DURATION);
    },
    commitStepPositions: ({ positions }) => {
      const { readonly, flowVersion } = get();
      if (readonly) {
        return;
      }
      applyStepPositions(
        stepPositionUtils.computeDragPositions({ flowVersion, positions }),
      );
    },
    commitStepDrag: ({ positions, dropTarget }) => {
      const { readonly, flowVersion, applyOperation, commitStepPositions } =
        get();
      if (readonly) {
        return;
      }
      const entries = Object.entries(positions);
      const move =
        !isNil(dropTarget) && entries.length === 1
          ? createMoveOperation({
              flowVersion,
              stepName: entries[0][0],
              dropTarget,
            })
          : null;
      if (isNil(move)) {
        commitStepPositions({ positions });
        return;
      }
      pendingMove = {
        name: move.request.name,
        position: stepPositionUtils.snapPosition(entries[0][1]),
      };
      applyOperation(move);
      pendingMove = null;
    },
    tidyUp: () => {
      const { readonly, flowVersion } = get();
      if (readonly) {
        return;
      }
      applyStepPositions(stepPositionUtils.computeTidyUp({ flowVersion }));
    },
    setPendingStepPosition: ({ selectorId, position }) => {
      set({
        pendingStepPosition: {
          selectorId,
          position: stepPositionUtils.snapPosition(position),
        },
      });
    },
    queueStepPositionsFollowUp: ({ previousVersion, operation }) => {
      const contribution = getFollowUpContribution({
        previousVersion,
        operation,
        pendingMove,
        pendingStepPosition: get().pendingStepPosition,
        openedSelectorId: get().openedPieceSelectorStepNameOrAddButtonId,
      });
      if (operation.type === FlowOperationType.ADD_ACTION) {
        set({ pendingStepPosition: null });
      }
      if (isNil(pendingFollowUp)) {
        pendingFollowUp = { previousVersion, movedNames: [], overrides: {} };
        queueMicrotask(flushInsertFollowUp);
      }
      pendingFollowUp = {
        previousVersion: pendingFollowUp.previousVersion,
        movedNames: [...pendingFollowUp.movedNames, ...contribution.movedNames],
        overrides: { ...pendingFollowUp.overrides, ...contribution.overrides },
      };
    },
  };
};

function createMoveOperation({
  flowVersion,
  stepName,
  dropTarget,
}: {
  flowVersion: FlowVersion;
  stepName: string;
  dropTarget: ApButtonData;
}): MoveOperation | null {
  const step = flowStructureUtil.getStep(stepName, flowVersion.trigger);
  if (
    isNil(step) ||
    flowStructureUtil.isTrigger(step.type) ||
    dropTarget.parentStepName === stepName ||
    flowStructureUtil.isChildOf(step, dropTarget.parentStepName)
  ) {
    return null;
  }
  return {
    type: FlowOperationType.MOVE_ACTION,
    request: {
      name: stepName,
      newParentStep: dropTarget.parentStepName,
      stepLocationRelativeToNewParent: dropTarget.stepLocationRelativeToParent,
      branchIndex:
        dropTarget.stepLocationRelativeToParent ===
        StepLocationRelativeToParent.INSIDE_BRANCH
          ? dropTarget.branchIndex
          : undefined,
    },
  };
}

function getFollowUpContribution({
  previousVersion,
  operation,
  pendingMove,
  pendingStepPosition,
  openedSelectorId,
}: {
  previousVersion: FlowVersion;
  operation: FlowOperationRequest;
  pendingMove: PendingMove | null;
  pendingStepPosition: PendingStepPosition | null;
  openedSelectorId: string | null;
}): Pick<PendingFollowUp, 'movedNames' | 'overrides'> {
  switch (operation.type) {
    case FlowOperationType.MOVE_ACTION: {
      const moved = flowStructureUtil.getStep(
        operation.request.name,
        previousVersion.trigger,
      );
      return {
        movedNames: isNil(moved)
          ? []
          : flowStructureUtil.getAllChildSteps(moved).map((step) => step.name),
        overrides:
          pendingMove?.name === operation.request.name
            ? { [pendingMove.name]: pendingMove.position }
            : {},
      };
    }
    case FlowOperationType.ADD_ACTION: {
      const matchesOpenSelector =
        !isNil(pendingStepPosition) &&
        pendingStepPosition.selectorId === openedSelectorId;
      return {
        movedNames: [],
        overrides: matchesOpenSelector
          ? { [operation.request.action.name]: pendingStepPosition.position }
          : {},
      };
    }
    default:
      return { movedNames: [], overrides: {} };
  }
}

const DROP_TARGET_FADE_DURATION = 100;

export const STEP_POSITION_FOLLOW_UP_OPERATIONS: FlowOperationType[] = [
  FlowOperationType.ADD_ACTION,
  FlowOperationType.DUPLICATE_ACTION,
  FlowOperationType.DUPLICATE_BRANCH,
  FlowOperationType.MOVE_ACTION,
];

export type LayoutState = {
  stepDrag: StepDrag | null;
  dropTargetId: string | null;
  pendingStepPosition: PendingStepPosition | null;
  startStepDrag: (params: {
    stepName: string;
    targets: ApDropTarget[];
  }) => void;
  setDropTargetId: (dropTargetId: string | null) => void;
  endStepDrag: () => void;
  commitStepPositions: (params: { positions: StepPositions }) => void;
  commitStepDrag: (params: {
    positions: StepPositions;
    dropTarget: ApButtonData | null;
  }) => void;
  tidyUp: () => void;
  setPendingStepPosition: (params: {
    selectorId: string;
    position: StepCanvasPosition;
  }) => void;
  queueStepPositionsFollowUp: (params: {
    previousVersion: FlowVersion;
    operation: FlowOperationRequest;
  }) => void;
};

export type StepDrag = {
  stepName: string;
  targets: ApDropTarget[];
  active: boolean;
};

export type PendingStepPosition = {
  selectorId: string;
  position: StepCanvasPosition;
};

type PendingFollowUp = {
  previousVersion: FlowVersion;
  movedNames: string[];
  overrides: StepPositions;
};

type PendingMove = {
  name: string;
  position: StepCanvasPosition;
};

type MoveOperation = Extract<
  FlowOperationRequest,
  { type: FlowOperationType.MOVE_ACTION }
>;
