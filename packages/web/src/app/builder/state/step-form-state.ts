import { StoreApi } from 'zustand';

import { BuilderState } from '../builder-hooks';

export const createStepFormState = (
  set: StoreApi<BuilderState>['setState'],
): StepFormState => {
  return {
    setInsertMentionHandler: (insertMention: InsertMentionHandler | null) => {
      set({ insertMention });
    },
    insertMention: null,
    isFocusInsideListMapperModeInput: false,
    setIsFocusInsideListMapperModeInput: (
      isFocusInsideListMapperModeInput: boolean,
    ) => {
      return set(() => ({
        isFocusInsideListMapperModeInput,
      }));
    },
    mappingDragSource: null,
    setMappingDragSource: (mappingDragSource: MappingDragSource | null) => {
      set({ mappingDragSource });
    },
  };
};

type InsertMentionHandler = (propertyPath: string) => void;

export type MappingDragSource = {
  label: string;
  propertyPath: string;
};

export type StepFormState = {
  insertMention: InsertMentionHandler | null;
  setInsertMentionHandler: (handler: InsertMentionHandler | null) => void;
  isFocusInsideListMapperModeInput: boolean;
  setIsFocusInsideListMapperModeInput: (
    isFocusInsideListMapperModeInput: boolean,
  ) => void;
  mappingDragSource: MappingDragSource | null;
  setMappingDragSource: (source: MappingDragSource | null) => void;
};
