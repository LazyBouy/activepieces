import { isNil } from '@activepieces/core-utils';
import {
  flowCanvasUtils as sharedFlowCanvasUtils,
  FlowActionType,
  flowStructureUtil,
  FlowTrigger,
  Step,
} from '@activepieces/shared';

function getNeighbourStep({
  trigger,
  stepName,
  direction,
}: {
  trigger: FlowTrigger;
  stepName: string;
  direction: CanvasNavigationDirection;
}): string | null {
  const slots = indexSlots(trigger);
  const slot = slots.get(stepName);
  const step = flowStructureUtil.getStep(stepName, trigger);
  if (isNil(slot) || isNil(step)) {
    return null;
  }
  switch (direction) {
    case 'left':
      return slot.previous;
    case 'right':
      return getNextStepName({ step, slot, trigger });
    case 'up':
      return getSiblingStepName({ slot, trigger, offset: -1 });
    case 'down':
      return getSiblingStepName({ slot, trigger, offset: 1 });
  }
}

function indexSlots(trigger: FlowTrigger): Map<string, StepSlot> {
  return new Map(
    walkChain({ head: trigger, previous: null, branch: null }).map((entry) => [
      entry.name,
      entry.slot,
    ]),
  );
}

function walkChain({
  head,
  previous,
  branch,
}: {
  head: Step | undefined;
  previous: string | null;
  branch: BranchPosition | null;
}): { name: string; slot: StepSlot }[] {
  const chain = getChain(head);
  return chain.flatMap((step, index) => {
    const loopBefore = findNearestLoopBefore({ chain, index });
    const slot: StepSlot = {
      previous: index === 0 ? previous : chain[index - 1].name,
      branch: isNil(branch) ? null : { ...branch, depth: index },
      loopBranch: loopBefore,
    };
    const children = getBranchHeads(step).flatMap((childHead, branchIndex) =>
      isNil(childHead) || isContinuation({ step, branchIndex })
        ? []
        : walkChain({
            head: childHead,
            previous: step.name,
            branch: { owner: step.name, index: branchIndex, depth: 0 },
          }),
    );
    return [{ name: step.name, slot }, ...children];
  });
}

function findNearestLoopBefore({
  chain,
  index,
}: {
  chain: Step[];
  index: number;
}): BranchPosition | null {
  const loopIndex = chain
    .slice(0, index)
    .map((step) => step.type === FlowActionType.LOOP_ON_ITEMS)
    .lastIndexOf(true);
  if (loopIndex === -1) {
    return null;
  }
  return {
    owner: chain[loopIndex].name,
    index: LOOP_DONE_INDEX,
    depth: index - loopIndex - 1,
  };
}

function getNextStepName({
  step,
  slot,
  trigger,
}: {
  step: Step;
  slot: StepSlot;
  trigger: FlowTrigger;
}): string | null {
  const firstOutputTarget = getBranchHeads(step).find(
    (head) => !isNil(head),
  )?.name;
  if (!isNil(firstOutputTarget)) {
    return firstOutputTarget;
  }
  if (!isNil(step.nextAction)) {
    return step.nextAction.name;
  }
  if (isNil(slot.branch)) {
    return null;
  }
  const owner = flowStructureUtil.getStep(slot.branch.owner, trigger);
  if (isNil(owner) || owner.type === FlowActionType.LOOP_ON_ITEMS) {
    return null;
  }
  return owner.nextAction?.name ?? null;
}

function getSiblingStepName({
  slot,
  trigger,
  offset,
}: {
  slot: StepSlot;
  trigger: FlowTrigger;
  offset: 1 | -1;
}): string | null {
  const position = slot.loopBranch ?? slot.branch;
  if (isNil(position)) {
    return null;
  }
  const owner = flowStructureUtil.getStep(position.owner, trigger);
  if (isNil(owner)) {
    return null;
  }
  const chains = getBranchHeads(owner).map((head) => getChain(head));
  const sibling = chains
    .map((chain, index) => ({ chain, index }))
    .filter(
      ({ chain, index }) =>
        chain.length > 0 && Math.sign(index - position.index) === offset,
    )
    .sort(
      (a, b) =>
        Math.abs(a.index - position.index) - Math.abs(b.index - position.index),
    )[0];
  if (isNil(sibling)) {
    return null;
  }
  return sibling.chain[Math.min(position.depth, sibling.chain.length - 1)].name;
}

function getBranchHeads(step: Step): (Step | undefined)[] {
  if (step.type === FlowActionType.LOOP_ON_ITEMS) {
    return [step.nextAction, step.firstLoopAction];
  }
  if (flowStructureUtil.isBranchedAction(step)) {
    return step.settings.branches.map(
      (_, index) => step.children[index] ?? undefined,
    );
  }
  if (flowStructureUtil.hasContinueOnFailureBranches(step)) {
    return sharedFlowCanvasUtils.getContinueOnFailureBranchPair(step);
  }
  return [];
}

function isContinuation({
  step,
  branchIndex,
}: {
  step: Step;
  branchIndex: number;
}): boolean {
  return (
    step.type === FlowActionType.LOOP_ON_ITEMS &&
    branchIndex === LOOP_DONE_INDEX
  );
}

function getChain(head: Step | undefined): Step[] {
  if (isNil(head)) {
    return [];
  }
  return [head, ...getChain(head.nextAction)];
}

const LOOP_DONE_INDEX = 0;

export const canvasNavigationUtils = {
  getNeighbourStep,
};

export type CanvasNavigationDirection = 'left' | 'right' | 'up' | 'down';

type BranchPosition = {
  owner: string;
  index: number;
  depth: number;
};

type StepSlot = {
  previous: string | null;
  branch: BranchPosition | null;
  loopBranch: BranchPosition | null;
};
