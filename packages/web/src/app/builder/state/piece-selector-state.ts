import { isNil } from '@activepieces/core-utils';
import {
  FlowOperationType,
  FlowTrigger,
  FlowTriggerType,
  StepLocationRelativeToParent,
  flowStructureUtil,
} from '@activepieces/shared';
import { StoreApi } from 'zustand';

import { PieceSelectorOperation } from '@/features/pieces';

import { BuilderState } from '../builder-hooks';
import { flowCanvasUtils } from '../flow-canvas/utils/flow-canvas-utils';

export const createPieceSelectorState = (
  get: StoreApi<BuilderState>['getState'],
  set: StoreApi<BuilderState>['setState'],
): PieceSelectorState => {
  const applyOpener = ({
    id,
    operation,
  }: {
    id: string | null;
    operation: PieceSelectorOperation | null;
  }) =>
    set((state) => ({
      openedPieceSelectorStepNameOrAddButtonId: id,
      pieceSelectorOperation: isNil(id) ? null : operation,
      pendingStepPosition:
        !isNil(id) && state.pendingStepPosition?.selectorId === id
          ? state.pendingStepPosition
          : null,
    }));

  return {
    openedPieceSelectorStepNameOrAddButtonId: null,
    pieceSelectorOperation: null,
    setOpenedPieceSelectorStepNameOrAddButtonId: (stepNameOrAddButtonId) =>
      applyOpener({
        id: stepNameOrAddButtonId,
        operation: isNil(stepNameOrAddButtonId)
          ? null
          : getStepOperation({
              stepName: stepNameOrAddButtonId,
              trigger: get().flowVersion.trigger,
            }),
      }),
    openPieceSelector: ({ id, operation }) => applyOpener({ id, operation }),
    openAddStepPieceSelector: () => {
      const { flowVersion, selectedStep } = get();
      applyOpener({
        id: TOOLBAR_OPENER_ID,
        operation: {
          type: FlowOperationType.ADD_ACTION,
          actionLocation: {
            parentStep: flowCanvasUtils.getAddStepParentName({
              trigger: flowVersion.trigger,
              selectedStep,
            }),
            stepLocationRelativeToParent: StepLocationRelativeToParent.AFTER,
          },
        },
      });
    },
    closePieceSelector: () => {
      const { openedPieceSelectorStepNameOrAddButtonId, flowVersion } = get();
      const wasOpenForEmptyTrigger =
        openedPieceSelectorStepNameOrAddButtonId === flowVersion.trigger.name &&
        flowVersion.trigger.type === FlowTriggerType.EMPTY;
      applyOpener({ id: null, operation: null });
      if (wasOpenForEmptyTrigger) {
        get().deselectStep();
      }
    },
  };
};

function getStepOperation({
  stepName,
  trigger,
}: {
  stepName: string;
  trigger: FlowTrigger;
}): PieceSelectorOperation | null {
  const step = flowStructureUtil.getStep(stepName, trigger);
  if (isNil(step)) {
    return null;
  }
  if (flowStructureUtil.isTrigger(step.type)) {
    return { type: FlowOperationType.UPDATE_TRIGGER };
  }
  return { type: FlowOperationType.UPDATE_ACTION, stepName };
}

const TOOLBAR_OPENER_ID = 'canvas-toolbar-add-step';

export const pieceSelectorStateUtils = {
  getStepOperation,
  TOOLBAR_OPENER_ID,
};

export type PieceSelectorState = {
  openedPieceSelectorStepNameOrAddButtonId: string | null;
  pieceSelectorOperation: PieceSelectorOperation | null;
  setOpenedPieceSelectorStepNameOrAddButtonId: (
    stepNameOrAddButtonId: string | null,
  ) => void;
  openPieceSelector: (params: {
    id: string;
    operation: PieceSelectorOperation;
  }) => void;
  openAddStepPieceSelector: () => void;
  closePieceSelector: () => void;
};
