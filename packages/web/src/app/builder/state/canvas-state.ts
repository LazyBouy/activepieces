import { isNil } from '@activepieces/core-utils';
import { FlowTriggerType, flowStructureUtil } from '@activepieces/shared';
import { StoreApi } from 'zustand';

import { RightSideBarType } from '@/app/builder/types';
import { flowRunUtils } from '@/features/flow-runs';

import { BuilderState } from '../builder-hooks';
import { flowCanvasUtils } from '../flow-canvas/utils/flow-canvas-utils';

export const createCanvasState = (
  initialState: CanvasStateInitialState,
  set: StoreApi<BuilderState>['setState'],
): CanvasState => {
  const failedStepNameInRun = initialState.run?.steps
    ? flowRunUtils.findLastStepWithStatus(
        initialState.run.status,
        initialState.run.steps,
      )
    : null;
  const initiallySelectedStep = flowCanvasUtils.determineInitiallySelectedStep(
    failedStepNameInRun,
    initialState.flowVersion,
  );
  return {
    readonly: initialState.readonly,
    hideTestWidget: initialState.hideTestWidget ?? false,
    selectedStep: initiallySelectedStep,
    rightSidebar: RightSideBarType.NONE,
    isStepModalOpen: false,
    stepModalEditNameOnOpen: false,
    removeStepSelection: () =>
      set({
        selectedStep: null,
        selectedBranchIndex: null,
        isStepModalOpen: false,
      }),
    setSelectedBranchIndex: (branchIndex: number | null) =>
      set({
        selectedBranchIndex: branchIndex,
      }),
    setReadOnly: (readonly: boolean) => set({ readonly }),
    renameFlowClientSide: (newName: string) => {
      set((state) => {
        return {
          flowVersion: {
            ...state.flowVersion,
            displayName: newName,
          },
        };
      });
    },
    selectStepByName: (
      selectedStep: string,
      options?: { fromAutoFocus?: boolean },
    ) => {
      set((state) => {
        const isEmptyTrigger =
          selectedStep === 'trigger' &&
          state.flowVersion.trigger.type === FlowTriggerType.EMPTY;
        return {
          ...buildSelectionChanges({
            state,
            stepName: selectedStep,
            fromAutoFocus: options?.fromAutoFocus ?? false,
          }),
          isStepModalOpen: state.isStepModalOpen && !isEmptyTrigger,
          stepModalEditNameOnOpen: false,
        };
      });
    },
    openStepModal: ({
      stepName,
      branchIndex = null,
      editName = false,
      runTest = false,
    }) => {
      set((state) => {
        const step = flowStructureUtil.getStep(
          stepName,
          state.flowVersion.trigger,
        );
        if (isNil(step) || step.type === FlowTriggerType.EMPTY) {
          return {};
        }
        return {
          ...buildSelectionChanges({
            state,
            stepName,
            fromAutoFocus: false,
          }),
          selectedBranchIndex: branchIndex,
          isStepModalOpen: true,
          stepModalEditNameOnOpen: editName,
          stepTestRequest: runTest ? stepName : null,
          userManuallySelectedStepDuringRun:
            state.userManuallySelectedStepDuringRun || !isNil(state.run),
        };
      });
    },
    closeStepModal: () =>
      set({
        isStepModalOpen: false,
        stepModalEditNameOnOpen: false,
        stepTestRequest: null,
      }),
    resumeLiveFollow: () =>
      set((state) => {
        if (isNil(state.run) || isNil(state.run.steps)) {
          return { userManuallySelectedStepDuringRun: false };
        }
        return {
          userManuallySelectedStepDuringRun: false,
          loopsIndexes: flowRunUtils.snapLoopsToLatestIteration(
            state.run,
            state.loopsIndexes,
          ),
        };
      }),
    userManuallySelectedStepDuringRun: false,
    exitStepSettings: () =>
      set(() => ({
        selectedStep: null,
        selectedBranchIndex: null,
        isStepModalOpen: false,
      })),
    setRightSidebar: (rightSidebar: RightSideBarType) => set({ rightSidebar }),
    selectedBranchIndex: null,
    selectedNodes: [],
    setSelectedNodes: (nodes) => {
      return set(() => ({
        selectedNodes: nodes,
      }));
    },
    deselectStep: () => {
      return set(() => ({
        selectedBranchIndex: null,
        selectedStep: null,
        isStepModalOpen: false,
      }));
    },
    isFocusInsideListMapperModeInput: false,
    setIsFocusInsideListMapperModeInput: (
      isFocusInsideListMapperModeInput: boolean,
    ) => {
      return set(() => ({
        isFocusInsideListMapperModeInput,
      }));
    },
    stepTestRequest: null,
    clearStepTestRequest: () => set({ stepTestRequest: null }),
  };
};

function buildSelectionChanges({
  state,
  stepName,
  fromAutoFocus,
}: {
  state: BuilderState;
  stepName: string;
  fromAutoFocus: boolean;
}): Partial<BuilderState> {
  const userPickedDifferentStepDuringRun =
    !fromAutoFocus && !isNil(state.run) && state.selectedStep !== stepName;
  return {
    openedPieceSelectorStepNameOrAddButtonId: null,
    stepTestRequest:
      state.stepTestRequest === stepName ? state.stepTestRequest : null,
    selectedStep: stepName,
    selectedBranchIndex: null,
    selectedNodes: [stepName],
    chatDrawerOpenSource: null,
    userManuallySelectedStepDuringRun:
      state.userManuallySelectedStepDuringRun ||
      userPickedDifferentStepDuringRun,
  };
}

export type CanvasState = {
  readonly: boolean;
  hideTestWidget: boolean;
  rightSidebar: RightSideBarType;
  selectedStep: string | null;
  selectedBranchIndex: number | null;
  userManuallySelectedStepDuringRun: boolean;
  isStepModalOpen: boolean;
  stepModalEditNameOnOpen: boolean;
  setSelectedBranchIndex: (index: number | null) => void;
  exitStepSettings: () => void;
  renameFlowClientSide: (newName: string) => void;
  setRightSidebar: (rightSidebar: RightSideBarType) => void;
  removeStepSelection: () => void;
  selectStepByName: (
    stepName: string,
    options?: { fromAutoFocus?: boolean },
  ) => void;
  openStepModal: (params: OpenStepModalParams) => void;
  closeStepModal: () => void;
  resumeLiveFollow: () => void;
  setReadOnly: (readOnly: boolean) => void;
  selectedNodes: string[];
  setSelectedNodes: (nodes: string[]) => void;
  isFocusInsideListMapperModeInput: boolean;
  setIsFocusInsideListMapperModeInput: (
    isFocusInsideListMapperModeInput: boolean,
  ) => void;
  deselectStep: () => void;
  stepTestRequest: string | null;
  clearStepTestRequest: () => void;
};

export type OpenStepModalParams = {
  stepName: string;
  branchIndex?: number | null;
  editName?: boolean;
  runTest?: boolean;
};

type CanvasStateInitialState = Pick<
  BuilderState,
  'readonly' | 'hideTestWidget' | 'run' | 'flowVersion'
>;
