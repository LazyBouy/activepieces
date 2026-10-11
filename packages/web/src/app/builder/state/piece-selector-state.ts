import { StoreApi } from 'zustand';

import { StepMetadataWithSuggestions } from '@/features/pieces';

import { BuilderState } from '../builder-hooks';

export type PieceSelectorState = {
  openedPieceSelectorStepNameOrAddButtonId: string | null;
  setOpenedPieceSelectorStepNameOrAddButtonId: (
    stepNameOrAddButtonId: string | null,
  ) => void;
  selectedPieceMetadataInPieceSelector: StepMetadataWithSuggestions | null;
  setSelectedPieceMetadataInPieceSelector: (
    metadata: StepMetadataWithSuggestions | null,
  ) => void;
};

export const createPieceSelectorState = (
  _: StoreApi<BuilderState>['getState'],
  set: StoreApi<BuilderState>['setState'],
): PieceSelectorState => {
  return {
    openedPieceSelectorStepNameOrAddButtonId: null,
    setOpenedPieceSelectorStepNameOrAddButtonId: (
      stepNameOrAddButtonId: string | null,
    ) => {
      return set((state) => {
        return {
          openedPieceSelectorStepNameOrAddButtonId: stepNameOrAddButtonId,
          pendingStepPosition:
            state.pendingStepPosition?.selectorId === stepNameOrAddButtonId
              ? state.pendingStepPosition
              : null,
        };
      });
    },
    selectedPieceMetadataInPieceSelector: null,
    setSelectedPieceMetadataInPieceSelector: (
      metadata: StepMetadataWithSuggestions | null,
    ) => {
      return set(() => ({
        selectedPieceMetadataInPieceSelector: metadata,
      }));
    },
  };
};
