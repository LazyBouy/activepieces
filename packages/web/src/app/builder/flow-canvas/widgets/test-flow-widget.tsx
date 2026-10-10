import { isNil, assertNotNullOrUndefined } from '@activepieces/core-utils';
import {
  FlowTriggerType,
  Permission,
  UpdateRunProgressRequest,
} from '@activepieces/shared';
import { useMutation } from '@tanstack/react-query';
import { t } from 'i18next';
import { Square } from 'lucide-react';

import { EditFlowOrViewDraftButton } from '@/app/builder/builder-header/flow-status/view-draft-or-edit-flow-button';
import {
  useBuilderStateContext,
  useBuilderStore,
} from '@/app/builder/builder-hooks';
import { ChatDrawerSource } from '@/app/builder/types';
import { Button } from '@/components/ui/button';
import { internalErrorToast } from '@/components/ui/sonner';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { flowRunsApi, flowRunUtils } from '@/features/flow-runs';
import { flowHooks } from '@/features/flows';
import { pieceSelectorUtils } from '@/features/pieces';
import { useAuthorization } from '@/hooks/authorization-hooks';

import { flowCanvasConsts } from '../utils/consts';

import { AboveTriggerButton } from './above-trigger-button';
import { testRunUtils } from './test-run-utils';

const TestFlowWidget = () => {
  const [
    setChatDrawerOpenSource,
    flowVersion,
    readonly,
    hideTestWidget,
    setRun,
    publishedVersionId,
    run,
  ] = useBuilderStateContext((state) => [
    state.setChatDrawerOpenSource,
    state.flowVersion,
    state.readonly,
    state.hideTestWidget,
    state.setRun,
    state.flow.publishedVersionId,
    state.run,
  ]);
  const builderStore = useBuilderStore();

  const { checkAccess } = useAuthorization();
  const userHasPermissionToRun = checkAccess(Permission.WRITE_RUN);

  const triggerHasSampleData =
    flowVersion.trigger.type === FlowTriggerType.PIECE &&
    !isNil(flowVersion.trigger.settings.sampleData?.lastTestDate);

  const isChatTrigger = pieceSelectorUtils.isChatTrigger(
    flowVersion.trigger.settings.pieceName,
    flowVersion.trigger.settings.triggerName,
  );
  const isManualTrigger = pieceSelectorUtils.isManualTrigger({
    pieceName: flowVersion.trigger.settings.pieceName,
    triggerName: flowVersion.trigger.settings.triggerName,
  });

  const { mutate: runFlow, isPending: isTestingFlow } =
    flowHooks.useTestFlowOrStartManualTrigger({
      flowVersionId: flowVersion.id,
      isForManualTrigger: isManualTrigger,
      onUpdateRun: (response: UpdateRunProgressRequest) => {
        assertNotNullOrUndefined(response.flowRun, 'flowRun');
        const currentRun = builderStore.getState().run;
        const previousSteps = currentRun?.steps ?? {};
        const startTime = response.flowRun.startTime ?? currentRun?.startTime;
        const steps = isNil(response.step)
          ? previousSteps
          : flowRunUtils.updateRunSteps(
              previousSteps,
              response.step.name,
              response.step.path,
              response.step.output,
            );
        setRun({ ...response.flowRun, startTime, steps }, flowVersion);
      },
    });

  const { mutate: cancelRun, isPending: isCancellingRun } = useMutation({
    mutationFn: async () => {
      const currentRun = builderStore.getState().run;
      assertNotNullOrUndefined(currentRun, 'run');
      await flowRunsApi.bulkCancel({
        projectId: currentRun.projectId,
        flowRunIds: [currentRun.id],
      });
      return flowRunsApi.getPopulated(currentRun.id);
    },
    onSuccess: (cancelledRun) => {
      setRun(cancelledRun, builderStore.getState().flowVersion);
    },
    onError: () => internalErrorToast(),
  });

  if (!flowVersion.valid) {
    return null;
  }

  if (hideTestWidget) {
    return null;
  }
  if (
    isManualTrigger &&
    (publishedVersionId !== flowVersion.id || isNil(publishedVersionId))
  ) {
    return null;
  }

  const { isRunning, isCancellable } = testRunUtils.getTestRunState({
    run,
    isStartingTestRun: isTestingFlow,
  });
  const runText = isChatTrigger
    ? t('Open Chat')
    : isManualTrigger
    ? t('Run Flow')
    : t('Test Flow');

  if (isRunning) {
    return (
      <>
        <AboveTriggerButton onClick={() => runFlow()} text={runText} loading />
        {isCancellable && (
          <StopRunButton
            onClick={() => cancelRun()}
            loading={isCancellingRun}
          />
        )}
      </>
    );
  }

  if (readonly) {
    return (
      <EditFlowOrViewDraftButton onCanvas={true}></EditFlowOrViewDraftButton>
    );
  }

  if (isChatTrigger) {
    return (
      <AboveTriggerButton
        onClick={() => {
          setChatDrawerOpenSource(ChatDrawerSource.TEST_FLOW);
        }}
        text={runText}
      />
    );
  }

  if (isManualTrigger && !userHasPermissionToRun) {
    return null;
  }

  return (
    <AboveTriggerButton
      onClick={() => {
        runFlow();
      }}
      text={runText}
      disable={!triggerHasSampleData && !isManualTrigger}
    />
  );
};

const StopRunButton = ({
  onClick,
  loading,
}: {
  onClick: () => void;
  loading: boolean;
}) => {
  return (
    <Tooltip delayDuration={flowCanvasConsts.CHROME_TOOLTIP_DELAY}>
      <TooltipTrigger asChild>
        <Button
          variant="secondary"
          size="icon-lg"
          aria-label={t('Stop')}
          loading={loading}
          onClick={onClick}
        >
          <Square className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{t('Stop')}</TooltipContent>
    </Tooltip>
  );
};

TestFlowWidget.displayName = 'TestFlowWidget';

export { TestFlowWidget };
