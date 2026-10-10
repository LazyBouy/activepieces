import { isNil } from '@activepieces/core-utils';
import { useMemo } from 'react';

import { useBuilderStateContext } from '../../../builder-hooks';
import { StepStatusVisual, canvasRunUtils } from '../../utils/canvas-run-utils';

export function useStepRunVisual({
  stepName,
  isSkipped,
}: {
  stepName: string;
  isSkipped: boolean;
}): StepStatusVisual | null {
  const [run, loopsIndexes, trigger] = useBuilderStateContext((state) => [
    state.run,
    state.loopsIndexes,
    state.flowVersion.trigger,
  ]);
  return useMemo(() => {
    if (isNil(run)) {
      return null;
    }
    const output = canvasRunUtils.getStepOutput({
      stepName,
      run,
      loopsIndexes,
    });
    return canvasRunUtils.resolveRunVisual({
      output,
      isSkipped,
      showsSampleData:
        stepName === trigger.name &&
        canvasRunUtils.isTriggerShowingSampleData({ trigger, run }),
      runCount: canvasRunUtils.getRunCount({
        stepName,
        trigger,
        run,
        loopsIndexes,
      }),
    });
  }, [run, loopsIndexes, trigger, stepName, isSkipped]);
}
