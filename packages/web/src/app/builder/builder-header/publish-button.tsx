import { isNil, Permission } from '@activepieces/core-utils';
import { PopulatedFlow } from '@activepieces/shared';
import { useMutation } from '@tanstack/react-query';
import { t } from 'i18next';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

import { RightSideBarType } from '@/app/builder/types';
import { LoadingSpinner } from '@/components/custom/spinner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { flowHooks, flowsApi } from '@/features/flows';
import { projectCollectionUtils } from '@/features/projects';
import { useAuthorization } from '@/hooks/authorization-hooks';
import { platformHooks } from '@/hooks/platform-hooks';
import { cn } from '@/lib/utils';

import { useBuilderStateContext } from '../builder-hooks';
import { runDiscard } from '../flow-canvas/widgets/discard-draft';
import {
  FailedRequiredActionsCheck,
  RequiredActionsDialog,
  useRequiredActionsCheck,
} from '../flow-canvas/widgets/required-actions-dialog';

import {
  PublishButtonDot,
  PublishButtonLabel,
  PublishButtonTooltip,
  publishButtonUtils,
} from './publish-button-utils';

const PublishButton = ({ isLockedByAnotherEditor }: PublishButtonProps) => {
  const [
    isSaving,
    isPublishing,
    setIsPublishing,
    flow,
    setFlow,
    setVersion,
    setRightSidebar,
    flowVersion,
    run,
  ] = useBuilderStateContext((state) => [
    state.saving,
    state.isPublishing,
    state.setIsPublishing,
    state.flow,
    state.setFlow,
    state.setVersion,
    state.setRightSidebar,
    state.flowVersion,
    state.run,
  ]);
  const { platform } = platformHooks.useCurrentPlatform();
  const { project } = projectCollectionUtils.useCurrentProject();
  const { checkAccess } = useAuthorization();
  const canWrite = checkAccess(Permission.WRITE_FLOW);
  const requiresApproval =
    platform.plan.environmentsEnabled &&
    project.sensitive &&
    !checkAccess(Permission.PUBLISH_SENSITIVE_FLOW_ACCESS);
  const { mutateAsync: overWriteDraftWithVersion } =
    flowHooks.useOverWriteDraftWithVersion({
      onSuccess: (updatedFlow) => {
        setVersion(updatedFlow.version);
        setRightSidebar(RightSideBarType.NONE);
      },
    });
  const { mutate: discardChanges, isPending: isDiscarding } = useMutation({
    mutationFn: () =>
      runDiscard({
        flow,
        overWriteDraftWithVersion,
        fetchFlow: flowsApi.get,
        setFlow,
        setVersion,
      }),
  });
  const { checkRequiredActions, explainServerRejection } =
    useRequiredActionsCheck();
  const [failedRequiredActionsCheck, setFailedRequiredActionsCheck] =
    useState<FailedRequiredActionsCheck | null>(null);
  const { mutateAsync: publish } = flowHooks.useChangeFlowStatus({
    flowId: flow.id,
    change: 'publish',
    onSuccess: (updatedFlow: PopulatedFlow) => {
      setFlow(updatedFlow);
      setVersion(updatedFlow.version);
    },
    setIsPublishing,
    onRequiredActionsMissing: (params) => {
      explainServerRejection(params)
        .then(setFailedRequiredActionsCheck)
        .catch(() => undefined);
    },
  });
  const handlePublish = async () => {
    setIsPublishing(true);
    const failedCheck = await checkRequiredActions(flowVersion);
    if (failedCheck) {
      setIsPublishing(false);
      setFailedRequiredActionsCheck(failedCheck);
      return;
    }
    await publish();
  };

  const hasPublishedVersion = !isNil(flow.publishedVersionId);
  const state = publishButtonUtils.getPublishButtonState({
    versionState: flowVersion.state,
    hasPublishedVersion,
    isPublishedVersionOpen: flowVersion.id === flow.publishedVersionId,
    isValid: flowVersion.valid,
    isSaving,
    isPublishing,
    isDiscarding,
    requiresApproval,
    hasOpenRun: !isNil(run),
    isLockedByAnotherEditor,
    canWrite,
  });
  if (!state.visible) {
    return null;
  }
  const showDiscard = publishButtonUtils.shouldShowDiscard({
    versionState: flowVersion.state,
    hasPublishedVersion,
  });
  const tooltip = state.tooltip ? TOOLTIP_TEXT[state.tooltip]() : null;

  return (
    <div
      data-publish-button
      className="flex h-8.5 shrink-0 items-stretch rounded-sm border border-gray-6"
    >
      <Tooltip delayDuration={PUBLISH_TOOLTIP_DELAY}>
        <TooltipTrigger asChild>
          <span className="peer/publish inline-flex">
            <Button
              variant="ghost"
              name="Publish"
              data-publish-state={state.dot}
              disabled={state.disabled}
              onClick={handlePublish}
              className="h-8 gap-2 rounded-none rounded-l-sm px-3 text-gray-12 hover:bg-gray-3 pressed:bg-gray-4 disabled:bg-transparent disabled:text-gray-10 disabled:opacity-100"
            >
              {state.dot !== 'none' && (
                <span
                  aria-hidden="true"
                  data-publish-dot={state.dot}
                  className={cn(
                    'size-2 shrink-0 rounded-full',
                    DOT_CLASS_NAME[state.dot],
                  )}
                />
              )}
              {state.spinner && (
                <span aria-hidden="true" className="flex">
                  <LoadingSpinner className="size-3 stroke-gray-12 [animation-duration:400ms]" />
                </span>
              )}
              {LABEL_TEXT[state.label]()}
            </Button>
          </span>
        </TooltipTrigger>
        {tooltip && (
          <TooltipContent side="bottom" sideOffset={PUBLISH_TOOLTIP_OFFSET}>
            {tooltip}
          </TooltipContent>
        )}
      </Tooltip>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-none rounded-r-sm border-l border-gray-6 peer-hover/publish:border-l-transparent"
          >
            <ChevronDown className="size-4 text-gray-11" />
            <span className="sr-only">{t('Publish options')}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {showDiscard && (
            <DropdownMenuItem
              disabled={!canWrite || state.spinner}
              onSelect={() => discardChanges()}
            >
              {t('Discard changes')}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onSelect={() => setRightSidebar(RightSideBarType.VERSIONS)}
          >
            {t('Version History')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <RequiredActionsDialog
        failedCheck={failedRequiredActionsCheck}
        onClose={() => setFailedRequiredActionsCheck(null)}
      />
    </div>
  );
};

PublishButton.displayName = 'PublishButton';
export { PublishButton };

const PUBLISH_TOOLTIP_DELAY = 300;
const PUBLISH_TOOLTIP_OFFSET = 15;

const DOT_CLASS_NAME: Record<Exclude<PublishButtonDot, 'none'>, string> = {
  unpublishedChanges: 'bg-warning-9',
  issues: 'bg-danger-9',
  published: 'bg-success-9',
};

const LABEL_TEXT: Record<PublishButtonLabel, () => string> = {
  publish: () => t('Publish'),
  requestApproval: () => t('Request approval'),
  published: () => t('Published'),
  saving: () => t('Saving...'),
  publishing: () => t('Publishing...'),
  discarding: () => t('Discarding changes...'),
};

const TOOLTIP_TEXT: Record<PublishButtonTooltip, () => string> = {
  saving: () => t('Saving...'),
  incompleteSteps: () => t('You have incomplete steps'),
  unpublishedChanges: () => t('You have unpublished changes'),
  permissionNeeded: () => t('Permission Needed'),
};

type PublishButtonProps = {
  isLockedByAnotherEditor: boolean;
};
