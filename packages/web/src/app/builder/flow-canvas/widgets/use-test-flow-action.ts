import { isNil, assertNotNullOrUndefined } from '@activepieces/core-utils';
import {
  FlowTriggerType,
  Permission,
  UpdateRunProgressRequest,
} from '@activepieces/shared';
import { useMutation } from '@tanstack/react-query';
import { t } from 'i18next';

import {
  useBuilderStateContext,
  useBuilderStore,
} from '@/app/builder/builder-hooks';
import { ChatDrawerSource } from '@/app/builder/types';
import { internalErrorToast } from '@/components/ui/sonner';
import { flowRunsApi, flowRunUtils } from '@/features/flow-runs';
import { flowHooks } from '@/features/flows';
import { pieceSelectorUtils } from '@/features/pieces';
import { useAuthorization } from '@/hooks/authorization-hooks';

import { testRunUtils } from './test-run-utils';

export function useTestFlowAction() {
  const [
    setChatDrawerOpenSource,
    flowVersion,
    readonly,
    hideTestWidget,
    setRun,
    publishedVersionId,
    run,
    setLogsPanelOpen,
  ] = useBuilderStateContext((state) => [
    state.setChatDrawerOpenSource,
    state.flowVersion,
    state.readonly,
    state.hideTestWidget,
    state.setRun,
    state.flow.publishedVersionId,
    state.run,
    state.setLogsPanelOpen,
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

  const { isRunning, isCancellable } = testRunUtils.getTestRunState({
    run,
    isStartingTestRun: isTestingFlow,
  });
  const isUnpublishedManualTrigger =
    isManualTrigger &&
    (publishedVersionId !== flowVersion.id || isNil(publishedVersionId));
  const runText = isChatTrigger
    ? t('Open Chat')
    : isManualTrigger
    ? t('Run Flow')
    : t('Test Flow');

  return {
    isAvailable:
      flowVersion.valid && !hideTestWidget && !isUnpublishedManualTrigger,
    canStart: !isManualTrigger || userHasPermissionToRun,
    readonly,
    runText,
    isChatTrigger,
    isRunning,
    isCancellable,
    isCancellingRun,
    needsSampleData: !triggerHasSampleData && !isManualTrigger,
    start: () => {
      if (isChatTrigger) {
        setChatDrawerOpenSource(ChatDrawerSource.TEST_FLOW);
        return;
      }
      setLogsPanelOpen(true);
      runFlow();
    },
    rerun: () => {
      setLogsPanelOpen(true);
      runFlow();
    },
    cancel: () => cancelRun(),
  };
}
