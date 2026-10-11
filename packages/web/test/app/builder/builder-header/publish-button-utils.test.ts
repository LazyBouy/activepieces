import { FlowVersionState } from '@activepieces/shared';
import { describe, expect, it } from 'vitest';

import {
  PublishButtonInput,
  publishButtonUtils,
} from '@/app/builder/builder-header/publish-button-utils';

function input(overrides: Partial<PublishButtonInput>): PublishButtonInput {
  return {
    versionState: FlowVersionState.DRAFT,
    hasPublishedVersion: false,
    isPublishedVersionOpen: false,
    isValid: true,
    isSaving: false,
    isPublishing: false,
    isDiscarding: false,
    requiresApproval: false,
    hasOpenRun: false,
    isLockedByAnotherEditor: false,
    canWrite: true,
    ...overrides,
  };
}

describe('publishButtonUtils.getPublishButtonState', () => {
  it('draft never published and valid: no dot, Publish, enabled', () => {
    expect(publishButtonUtils.getPublishButtonState(input({}))).toEqual({
      visible: true,
      dot: 'none',
      label: 'publish',
      spinner: false,
      disabled: false,
      tooltip: null,
    });
  });

  it('draft never published and valid with approval: Request approval', () => {
    expect(
      publishButtonUtils.getPublishButtonState(
        input({ requiresApproval: true }),
      ),
    ).toMatchObject({ dot: 'none', label: 'requestApproval', disabled: false });
  });

  it('draft never published with incomplete steps: disabled with the reason', () => {
    expect(
      publishButtonUtils.getPublishButtonState(input({ isValid: false })),
    ).toEqual({
      visible: true,
      dot: 'none',
      label: 'publish',
      spinner: false,
      disabled: true,
      tooltip: 'incompleteSteps',
    });
  });

  it('draft of a published flow, valid: warning dot for unpublished changes', () => {
    expect(
      publishButtonUtils.getPublishButtonState(
        input({ hasPublishedVersion: true }),
      ),
    ).toEqual({
      visible: true,
      dot: 'unpublishedChanges',
      label: 'publish',
      spinner: false,
      disabled: false,
      tooltip: 'unpublishedChanges',
    });
  });

  it('draft of a published flow with approval keeps the dot and asks for approval', () => {
    expect(
      publishButtonUtils.getPublishButtonState(
        input({ hasPublishedVersion: true, requiresApproval: true }),
      ),
    ).toMatchObject({ dot: 'unpublishedChanges', label: 'requestApproval' });
  });

  it('draft of a published flow with incomplete steps: danger dot, disabled', () => {
    expect(
      publishButtonUtils.getPublishButtonState(
        input({
          hasPublishedVersion: true,
          isValid: false,
          requiresApproval: true,
        }),
      ),
    ).toEqual({
      visible: true,
      dot: 'issues',
      label: 'publish',
      spinner: false,
      disabled: true,
      tooltip: 'incompleteSteps',
    });
  });

  it('the published version is open: success dot, Published, disabled', () => {
    expect(
      publishButtonUtils.getPublishButtonState(
        input({
          versionState: FlowVersionState.LOCKED,
          hasPublishedVersion: true,
          isPublishedVersionOpen: true,
        }),
      ),
    ).toEqual({
      visible: true,
      dot: 'published',
      label: 'published',
      spinner: false,
      disabled: true,
      tooltip: null,
    });
  });

  it('an old locked version is open: the control is hidden', () => {
    expect(
      publishButtonUtils.getPublishButtonState(
        input({
          versionState: FlowVersionState.LOCKED,
          hasPublishedVersion: true,
          isPublishedVersionOpen: false,
        }),
      ).visible,
    ).toBe(false);
  });

  it.each([
    { isSaving: true, label: 'saving', tooltip: 'saving' },
    { isPublishing: true, label: 'publishing', tooltip: null },
    { isDiscarding: true, label: 'discarding', tooltip: null },
  ] as const)(
    'shows a spinner and no dot while $label',
    ({ label, tooltip, ...flags }) => {
      expect(
        publishButtonUtils.getPublishButtonState(
          input({ hasPublishedVersion: true, ...flags }),
        ),
      ).toEqual({
        visible: true,
        dot: 'none',
        label,
        spinner: true,
        disabled: true,
        tooltip,
      });
    },
  );

  it('saving wins over publishing and discarding', () => {
    expect(
      publishButtonUtils.getPublishButtonState(
        input({ isSaving: true, isPublishing: true, isDiscarding: true }),
      ).label,
    ).toBe('saving');
  });

  it('saving the first edit of the published version shows Saving...', () => {
    expect(
      publishButtonUtils.getPublishButtonState(
        input({
          versionState: FlowVersionState.LOCKED,
          hasPublishedVersion: true,
          isPublishedVersionOpen: true,
          isSaving: true,
        }),
      ),
    ).toMatchObject({ label: 'saving', spinner: true, dot: 'none' });
  });

  it('without write permission keeps the dot and label but disables with Permission Needed', () => {
    expect(
      publishButtonUtils.getPublishButtonState(
        input({ hasPublishedVersion: true, canWrite: false }),
      ),
    ).toEqual({
      visible: true,
      dot: 'unpublishedChanges',
      label: 'publish',
      spinner: false,
      disabled: true,
      tooltip: 'permissionNeeded',
    });
  });

  it.each([{ hasOpenRun: true }, { isLockedByAnotherEditor: true }])(
    'is hidden when %o',
    (flags) => {
      expect(
        publishButtonUtils.getPublishButtonState(
          input({ hasPublishedVersion: true, isSaving: true, ...flags }),
        ).visible,
      ).toBe(false);
    },
  );
});

describe('publishButtonUtils.shouldShowDiscard', () => {
  it('shows discard only for a draft of a published flow', () => {
    expect(
      publishButtonUtils.shouldShowDiscard({
        versionState: FlowVersionState.DRAFT,
        hasPublishedVersion: true,
      }),
    ).toBe(true);
    expect(
      publishButtonUtils.shouldShowDiscard({
        versionState: FlowVersionState.DRAFT,
        hasPublishedVersion: false,
      }),
    ).toBe(false);
    expect(
      publishButtonUtils.shouldShowDiscard({
        versionState: FlowVersionState.LOCKED,
        hasPublishedVersion: true,
      }),
    ).toBe(false);
  });
});
