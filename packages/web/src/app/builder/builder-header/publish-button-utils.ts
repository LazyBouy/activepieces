import { FlowVersionState } from '@activepieces/shared';

function getPublishButtonState(input: PublishButtonInput): PublishButtonState {
  if (input.hasOpenRun || input.isLockedByAnotherEditor) {
    return HIDDEN_STATE;
  }
  const isDraft = input.versionState === FlowVersionState.DRAFT;
  if (!isDraft && !input.isPublishedVersionOpen) {
    return HIDDEN_STATE;
  }
  if (input.isSaving) {
    return busyState({ label: 'saving', tooltip: 'saving' });
  }
  if (input.isPublishing) {
    return busyState({ label: 'publishing', tooltip: null });
  }
  if (input.isDiscarding) {
    return busyState({ label: 'discarding', tooltip: null });
  }
  if (!isDraft) {
    return {
      visible: true,
      dot: 'published',
      label: 'published',
      spinner: false,
      disabled: true,
      tooltip: null,
    };
  }
  const dot = pickDraftDot(input);
  const label: PublishButtonLabel =
    input.isValid && input.requiresApproval ? 'requestApproval' : 'publish';
  if (!input.canWrite) {
    return {
      visible: true,
      dot,
      label,
      spinner: false,
      disabled: true,
      tooltip: 'permissionNeeded',
    };
  }
  if (!input.isValid) {
    return {
      visible: true,
      dot,
      label,
      spinner: false,
      disabled: true,
      tooltip: 'incompleteSteps',
    };
  }
  return {
    visible: true,
    dot,
    label,
    spinner: false,
    disabled: false,
    tooltip: input.hasPublishedVersion ? 'unpublishedChanges' : null,
  };
}

function shouldShowDiscard({
  versionState,
  hasPublishedVersion,
}: Pick<PublishButtonInput, 'versionState' | 'hasPublishedVersion'>): boolean {
  return versionState === FlowVersionState.DRAFT && hasPublishedVersion;
}

function pickDraftDot(input: PublishButtonInput): PublishButtonDot {
  if (!input.hasPublishedVersion) {
    return 'none';
  }
  return input.isValid ? 'unpublishedChanges' : 'issues';
}

function busyState({
  label,
  tooltip,
}: {
  label: PublishButtonLabel;
  tooltip: PublishButtonTooltip | null;
}): PublishButtonState {
  return {
    visible: true,
    dot: 'none',
    label,
    spinner: true,
    disabled: true,
    tooltip,
  };
}

const HIDDEN_STATE: PublishButtonState = {
  visible: false,
  dot: 'none',
  label: 'publish',
  spinner: false,
  disabled: true,
  tooltip: null,
};

export const publishButtonUtils = {
  getPublishButtonState,
  shouldShowDiscard,
};

export type PublishButtonInput = {
  versionState: FlowVersionState;
  hasPublishedVersion: boolean;
  isPublishedVersionOpen: boolean;
  isValid: boolean;
  isSaving: boolean;
  isPublishing: boolean;
  isDiscarding: boolean;
  requiresApproval: boolean;
  hasOpenRun: boolean;
  isLockedByAnotherEditor: boolean;
  canWrite: boolean;
};

export type PublishButtonDot =
  | 'none'
  | 'unpublishedChanges'
  | 'issues'
  | 'published';

export type PublishButtonLabel =
  | 'publish'
  | 'requestApproval'
  | 'published'
  | 'saving'
  | 'publishing'
  | 'discarding';

export type PublishButtonTooltip =
  | 'saving'
  | 'incompleteSteps'
  | 'unpublishedChanges'
  | 'permissionNeeded';

export type PublishButtonState = {
  visible: boolean;
  dot: PublishButtonDot;
  label: PublishButtonLabel;
  spinner: boolean;
  disabled: boolean;
  tooltip: PublishButtonTooltip | null;
};
