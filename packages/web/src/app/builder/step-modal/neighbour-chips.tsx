import {
  FlowAction,
  FlowActionType,
  FlowTrigger,
  FlowTriggerType,
  flowStructureUtil,
} from '@activepieces/shared';

import { LogoPlate } from '@/components/custom/logo-plate';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { stepsHooks } from '@/features/pieces';
import { cn } from '@/lib/utils';

import { useBuilderStateContext } from '../builder-hooks';

const NeighbourChips = () => {
  const [trigger, selectedStep, selectStepByName] = useBuilderStateContext(
    (state) => [
      state.flowVersion.trigger,
      state.selectedStep,
      state.selectStepByName,
    ],
  );
  if (!selectedStep) {
    return null;
  }
  const { previous, next } = neighbourUtils.getNeighbours({
    trigger,
    stepName: selectedStep,
  });
  return (
    <>
      <NeighbourColumn
        side="left"
        steps={previous}
        onSelect={selectStepByName}
      />
      <NeighbourColumn side="right" steps={next} onSelect={selectStepByName} />
    </>
  );
};

const NeighbourColumn = ({
  side,
  steps,
  onSelect,
}: {
  side: 'left' | 'right';
  steps: (FlowAction | FlowTrigger)[];
  onSelect: (stepName: string) => void;
}) => {
  if (steps.length === 0) {
    return null;
  }
  return (
    <div
      data-step-modal-neighbours={side}
      className={cn(
        'absolute top-1/2 z-10 flex -translate-y-1/2 flex-col gap-4',
        side === 'left' ? 'left-0 -translate-x-1/2' : 'right-0 translate-x-1/2',
      )}
    >
      {steps.map((step) => (
        <NeighbourChip
          key={step.name}
          step={step}
          side={side}
          onSelect={() => onSelect(step.name)}
        />
      ))}
    </div>
  );
};

const NeighbourChip = ({
  step,
  side,
  onSelect,
}: {
  step: FlowAction | FlowTrigger;
  side: 'left' | 'right';
  onSelect: () => void;
}) => {
  const { stepMetadata } = stepsHooks.useStepMetadata({ step });
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={step.displayName}
          data-neighbour-step={step.name}
          onClick={onSelect}
          className="flex size-11 scale-80 items-center justify-center rounded-lg border border-gray-6 bg-canvas-step p-3 transition-transform duration-200 ease-expo-out outline-none hover:scale-110 focus-visible:scale-110 focus-visible:border-focus"
        >
          <LogoPlate
            size="row"
            src={stepMetadata?.logoUrl}
            alt={stepMetadata?.displayName ?? step.displayName}
          />
        </button>
      </TooltipTrigger>
      <TooltipContent side={side === 'left' ? 'right' : 'left'}>
        {step.displayName}
      </TooltipContent>
    </Tooltip>
  );
};

function getNeighbours({
  trigger,
  stepName,
}: {
  trigger: FlowTrigger;
  stepName: string;
}): Neighbours {
  const step = flowStructureUtil.getStep(stepName, trigger);
  if (!step) {
    return { previous: [], next: [] };
  }
  const previous = flowStructureUtil.findPathToStep(trigger, stepName).at(-1);
  return {
    previous:
      previous && previous.type !== FlowTriggerType.EMPTY ? [previous] : [],
    next: getNextSteps(step),
  };
}

function getNextSteps(step: FlowAction | FlowTrigger): FlowAction[] {
  const firsts: (FlowAction | null | undefined)[] = [];
  if (flowStructureUtil.isBranchedAction(step)) {
    firsts.push(...step.children);
  }
  if (step.type === FlowActionType.LOOP_ON_ITEMS) {
    firsts.push(step.firstLoopAction);
  }
  if (step.type === FlowActionType.CODE || step.type === FlowActionType.PIECE) {
    firsts.push(
      step.continueOnFailureBranches?.onSuccess,
      step.continueOnFailureBranches?.onFailure,
    );
  }
  firsts.push(step.nextAction);
  return firsts.filter((candidate): candidate is FlowAction => !!candidate);
}

export const neighbourUtils = {
  getNeighbours,
};

export { NeighbourChips };

type Neighbours = {
  previous: (FlowAction | FlowTrigger)[];
  next: FlowAction[];
};
