export enum PieceSelectorTabType {
  AI_AND_AGENTS = 'AI_AND_AGENTS',
  APPS = 'APPS',
  DATA_TRANSFORMATION = 'DATA_TRANSFORMATION',
  FLOW_CONTROL = 'FLOW_CONTROL',
  UTILITY = 'UTILITY',
  APPROVALS = 'APPROVALS',
  CUSTOM = 'CUSTOM',
  NONE = 'NONE',
}

export type PieceSelectorCategoryType = Exclude<
  PieceSelectorTabType,
  PieceSelectorTabType.CUSTOM | PieceSelectorTabType.NONE
>;
