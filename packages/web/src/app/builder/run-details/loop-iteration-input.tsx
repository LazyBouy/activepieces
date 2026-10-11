import { isNil } from '@activepieces/core-utils';
import {
  FlowActionType,
  FlowTrigger,
  StepOutput,
  flowStructureUtil,
} from '@activepieces/shared';
import { t } from 'i18next';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { flowRunUtils } from '@/features/flow-runs';

import { useBuilderStateContext } from '../builder-hooks';

const LoopIterationInput = ({ stepName }: { stepName: string }) => {
  const [run, loopsIndexes, trigger, setLoopIndex] = useBuilderStateContext(
    (state) => [
      state.run,
      state.loopsIndexes,
      state.flowVersion.trigger,
      state.setLoopIndex,
    ],
  );
  const loopName = findIterationLoop({ stepName, trigger });
  if (isNil(run) || isNil(run.steps) || isNil(loopName)) {
    return null;
  }
  const loopOutput = flowRunUtils.extractStepOutput(
    loopName,
    loopsIndexes,
    run.steps,
  );
  const total = getIterationCount(loopOutput);
  if (total === 0) {
    return null;
  }
  const currentIndex = Math.min(loopsIndexes[loopName] ?? 0, total - 1);
  const currentLabel = t('Iteration {index} of {total}', {
    index: currentIndex + 1,
    total,
  });
  return (
    <Select
      value={String(currentIndex)}
      onValueChange={(value) => setLoopIndex(loopName, Number(value))}
    >
      <SelectTrigger
        size="sm"
        aria-label={currentLabel}
        title={currentLabel}
        data-loop-iteration-select={loopName}
        className="h-7 w-auto min-w-0 shrink gap-1 px-2 text-xs"
      >
        <SelectValue>
          <span className="truncate">{currentLabel}</span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {Array.from({ length: total }, (_, index) => (
          <SelectItem key={index} value={String(index)} className="text-xs">
            {t('Iteration {index} of {total}', { index: index + 1, total })}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

LoopIterationInput.displayName = 'LoopIterationInput';

function findIterationLoop({
  stepName,
  trigger,
}: {
  stepName: string;
  trigger: FlowTrigger;
}): string | null {
  const step = flowStructureUtil.getStep(stepName, trigger);
  if (isNil(step)) {
    return null;
  }
  if (step.type === FlowActionType.LOOP_ON_ITEMS) {
    return step.name;
  }
  const enclosingLoops = flowStructureUtil
    .findPathToStep(trigger, stepName)
    .filter(
      (candidate) =>
        candidate.type === FlowActionType.LOOP_ON_ITEMS &&
        flowStructureUtil.isChildOf(candidate, stepName),
    );
  return enclosingLoops.at(-1)?.name ?? null;
}

function getIterationCount(output: StepOutput | undefined): number {
  if (isNil(output) || output.type !== FlowActionType.LOOP_ON_ITEMS) {
    return 0;
  }
  return output.output?.iterations.length ?? 0;
}

export { LoopIterationInput };

export const loopIterationUtils = {
  findIterationLoop,
};
