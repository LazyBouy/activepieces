import { isNil } from '@activepieces/core-utils';
import {
  FlowTriggerType,
  FlowVersionState,
  flowStructureUtil,
} from '@activepieces/shared';

import { pieceSelectorUtils } from '@/features/pieces';

import { useBuilderStateContext } from '../../../builder-hooks';
import { StepStatusVisual, canvasRunUtils } from '../../utils/canvas-run-utils';

export function useStepDraftVisual({
  stepName,
  isSkipped,
}: {
  stepName: string;
  isSkipped: boolean;
}): StepStatusVisual {
  const [
    hasRun,
    isBeingTested,
    errorMessage,
    lastTestDate,
    lastUpdatedDate,
    stepType,
    isInDraft,
    isStepValid,
    isManualTrigger,
  ] = useBuilderStateContext((state) => {
    const step = flowStructureUtil.getStep(stepName, state.flowVersion.trigger);
    const isManualTrigger =
      step?.type === FlowTriggerType.PIECE &&
      pieceSelectorUtils.isManualTrigger({
        pieceName: step.settings.pieceName,
        triggerName: step.settings.triggerName ?? '',
      });
    const sampleDataTestDate = step?.settings?.sampleData?.lastTestDate;
    return [
      !isNil(state.run),
      state.isStepBeingTested(stepName),
      state.errorLogs[stepName] ?? null,
      typeof sampleDataTestDate === 'string' ? sampleDataTestDate : undefined,
      step?.lastUpdatedDate ?? '',
      step?.type,
      state.flowVersion.state === FlowVersionState.DRAFT,
      !!step?.valid,
      isManualTrigger,
    ];
  });
  const showsDraftStatus =
    isInDraft &&
    !hasRun &&
    stepType !== FlowTriggerType.EMPTY &&
    !isManualTrigger;
  return canvasRunUtils.resolveDraftVisual({
    status: showsDraftStatus
      ? canvasRunUtils.getDraftStatus({
          isValid: isStepValid,
          isBeingTested,
          hasError: !isNil(errorMessage),
          lastTestDate,
          lastUpdatedDate,
        })
      : null,
    isSkipped: isSkipped && stepType !== FlowTriggerType.EMPTY,
    errorMessage,
  });
}
