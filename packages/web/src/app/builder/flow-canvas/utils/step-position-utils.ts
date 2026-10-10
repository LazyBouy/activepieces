import { isNil } from '@activepieces/core-utils';
import {
  FlowAction,
  FlowActionType,
  FlowTrigger,
  FlowVersion,
  Step,
  StepCanvasPosition,
  StepPositions,
  flowCanvasUtils as sharedFlowCanvasUtils,
  flowLayoutUtil,
  flowStructureUtil,
} from '@activepieces/shared';

import { flowCanvasUtils } from './flow-canvas-utils';
import { ApDropTarget, ApGraph, ApNodeType } from './types';

function computeDragPositions({
  flowVersion,
  positions,
}: {
  flowVersion: FlowVersion;
  positions: StepPositions;
}): StepPositions {
  const stored = flowVersion.stepPositions ?? {};
  const resolved = flowLayoutUtil.resolveStepPositions({
    trigger: flowVersion.trigger,
    stepPositions: stored,
  }).steps;
  const changed = Object.entries(positions).reduce<StepPositions>(
    (acc, [name, position]) => {
      const snapped = snapPosition(position);
      if (
        isNil(resolved[name]) ||
        isSamePosition({ a: snapped, b: resolved[name] })
      ) {
        return acc;
      }
      return { ...acc, [name]: snapped };
    },
    {},
  );
  if (isEmptyMap(changed)) {
    return {};
  }
  return isEmptyMap(stored) ? { ...resolved, ...changed } : changed;
}

function computeTidyUp({
  flowVersion,
}: {
  flowVersion: FlowVersion;
}): StepPositions {
  const stored = flowVersion.stepPositions ?? {};
  const positions = flowLayoutUtil.tidyUp({
    trigger: flowVersion.trigger,
    stepPositions: stored,
  });
  const unchanged = Object.entries(positions).every(([name, position]) =>
    isSamePosition({ a: position, b: stored[name] }),
  );
  return unchanged ? {} : positions;
}

function computeInsertFollowUp({
  previousVersion,
  currentVersion,
  movedNames,
  overrides,
}: {
  previousVersion: FlowVersion;
  currentVersion: FlowVersion;
  movedNames: string[];
  overrides: StepPositions;
}): StepPositions {
  const previousStored = previousVersion.stepPositions ?? {};
  const materialize = isEmptyMap(previousStored);
  if (materialize && isEmptyMap(overrides)) {
    return {};
  }
  const { trigger } = currentVersion;
  const visibleSteps = flowLayoutUtil.getVisibleSteps({ trigger });
  const visibleNames = new Set(visibleSteps.map((step) => step.name));
  const previousNames = new Set(
    flowStructureUtil
      .getAllSteps(previousVersion.trigger)
      .map((step) => step.name),
  );
  const insertedNames = new Set([
    ...visibleSteps
      .map((step) => step.name)
      .filter((name) => !previousNames.has(name)),
    ...movedNames.filter((name) => visibleNames.has(name)),
  ]);
  if (insertedNames.size === 0) {
    return {};
  }
  const base = materialize
    ? pickPositions({
        positions: flowLayoutUtil.resolveStepPositions({
          trigger: previousVersion.trigger,
          stepPositions: {},
        }).steps,
        names: [...visibleNames].filter((name) => !insertedNames.has(name)),
      })
    : currentVersion.stepPositions ?? {};
  const resolved = flowLayoutUtil.resolveStepPositions({
    trigger,
    stepPositions: base,
  }).steps;
  const placed = placeInsertedSteps({
    trigger,
    insertedNames,
    resolved,
    overrides,
  });
  const shifted = shiftOverlappedSteps({
    trigger,
    previousVersion,
    visibleSteps,
    visibleNames,
    insertedNames,
    positions: { ...base, ...placed },
  });
  if (materialize) {
    return pickPositions({
      positions: { ...resolved, ...shifted.positions },
      names: [...visibleNames],
    });
  }
  return pickPositions({
    positions: shifted.positions,
    names: [...insertedNames, ...shifted.names],
  });
}

function getDropTargets({
  graph,
  trigger,
  draggedStepName,
}: {
  graph: ApGraph;
  trigger: FlowTrigger;
  draggedStepName: string;
}): ApDropTarget[] {
  const dragged = flowStructureUtil.getStep(draggedStepName, trigger);
  if (isNil(dragged) || flowStructureUtil.isTrigger(dragged.type)) {
    return [];
  }
  const excluded = new Set(
    flowStructureUtil.getAllChildSteps(dragged).map((step) => step.name),
  );
  const edgeTargets = graph.edges
    .filter(
      (edge) =>
        !excluded.has(edge.data.sourceStepName) &&
        !excluded.has(edge.target) &&
        !excluded.has(edge.data.insertLocation.parentStepName),
    )
    .map((edge) => ({ id: edge.id, location: edge.data.insertLocation }));
  const stubTargets = graph.nodes.flatMap((node): ApDropTarget[] => {
    switch (node.type) {
      case ApNodeType.STEP:
        return excluded.has(node.id)
          ? []
          : node.data.outputs
              .filter((output) => output.hasStub)
              .map((output) => ({
                id: flowCanvasUtils.getOutputStubId({
                  stepName: node.id,
                  outputId: output.id,
                }),
                location: output.insertLocation,
              }));
      case ApNodeType.JOIN:
        return isNil(node.data.stub) || excluded.has(node.data.stepName)
          ? []
          : [
              {
                id: flowCanvasUtils.getJoinStubId(node.data.stepName),
                location: node.data.stub,
              },
            ];
      case ApNodeType.NOTE:
        return [];
    }
  });
  return [...edgeTargets, ...stubTargets];
}

function getDropTargetState({
  stepDrag,
  dropTargetId,
  id,
}: {
  stepDrag: { targets: ApDropTarget[]; active: boolean } | null;
  dropTargetId: string | null;
  id: string;
}): DropTargetState {
  if (isNil(stepDrag) || !stepDrag.targets.some((target) => target.id === id)) {
    return 'none';
  }
  if (!stepDrag.active) {
    return 'fading';
  }
  return dropTargetId === id ? 'armed' : 'idle';
}

function placeInsertedSteps({
  trigger,
  insertedNames,
  resolved,
  overrides,
}: {
  trigger: FlowTrigger;
  insertedNames: Set<string>;
  resolved: StepPositions;
  overrides: StepPositions;
}): StepPositions {
  const offsets = Object.entries(overrides).reduce<Record<string, Offset>>(
    (acc, [name, position]) => {
      const step = flowStructureUtil.getStep(name, trigger);
      if (isNil(step) || isNil(resolved[name])) {
        return acc;
      }
      const offset = {
        dx: position.x - resolved[name].x,
        dy: position.y - resolved[name].y,
      };
      const subtree = flowStructureUtil
        .getAllChildSteps(step)
        .map((child) => child.name)
        .filter((childName) => insertedNames.has(childName));
      return {
        ...acc,
        ...Object.fromEntries(subtree.map((childName) => [childName, offset])),
      };
    },
    {},
  );
  return Object.fromEntries(
    [...insertedNames]
      .filter((name) => !isNil(resolved[name]))
      .map((name) => {
        const offset = offsets[name] ?? { dx: 0, dy: 0 };
        return [
          name,
          snapPosition({
            x: resolved[name].x + offset.dx,
            y: resolved[name].y + offset.dy,
          }),
        ];
      }),
  );
}

function shiftOverlappedSteps({
  trigger,
  previousVersion,
  visibleSteps,
  visibleNames,
  insertedNames,
  positions,
}: {
  trigger: FlowTrigger;
  previousVersion: FlowVersion;
  visibleSteps: Step[];
  visibleNames: Set<string>;
  insertedNames: Set<string>;
  positions: StepPositions;
}): ShiftResult {
  const containers = buildContainers(trigger);
  const previousJoins = flowLayoutUtil.resolveStepPositions({
    trigger: previousVersion.trigger,
    stepPositions: previousVersion.stepPositions,
  }).joins;
  const exits = visibleSteps.filter(
    (step) =>
      insertedNames.has(step.name) &&
      (isNil(step.nextAction) || !insertedNames.has(step.nextAction.name)),
  );
  return exits.reduce<ShiftResult>(
    (acc, exit) => {
      const chain = getInsertedChainEndingAt({
        exit,
        trigger,
        insertedNames,
      });
      const dx = flowLayoutUtil.constants.PITCH * chain.length;
      const next = exit.nextAction;
      const afterNext =
        !isNil(next) &&
        isOverlapped({ chain, next, positions: acc.positions, trigger })
          ? shiftDownstream({
              head: next,
              dx,
              visibleNames,
              result: acc,
              trigger,
            })
          : acc;
      return propagateToContainers({
        stepName: exit.name,
        dx,
        trigger,
        containers,
        previousJoins,
        visibleNames,
        result: afterNext,
      });
    },
    { positions, names: [] },
  );
}

function propagateToContainers({
  stepName,
  dx,
  trigger,
  containers,
  previousJoins,
  visibleNames,
  result,
}: {
  stepName: string;
  dx: number;
  trigger: FlowTrigger;
  containers: Map<string, string | null>;
  previousJoins: StepPositions;
  visibleNames: Set<string>;
  result: ShiftResult;
}): ShiftResult {
  const parentName = containers.get(stepName);
  const parent = isNil(parentName)
    ? undefined
    : flowStructureUtil.getStep(parentName, trigger);
  if (isNil(parent) || !flowLayoutUtil.hasJoin(parent)) {
    return result;
  }
  const continuation = parent.nextAction;
  if (isNil(continuation)) {
    return propagateToContainers({
      stepName: parent.name,
      dx,
      trigger,
      containers,
      previousJoins,
      visibleNames,
      result,
    });
  }
  const layout = flowLayoutUtil.resolveStepPositions({
    trigger,
    stepPositions: result.positions,
  });
  const join = layout.joins[parent.name];
  const previousJoin = previousJoins[parent.name];
  const continuationPosition = layout.steps[continuation.name];
  if (isNil(join) || isNil(previousJoin) || isNil(continuationPosition)) {
    return result;
  }
  const joinMovedRight = join.x > previousJoin.x;
  const blocksContinuation =
    continuationPosition.x <
    join.x + flowLayoutUtil.constants.JOIN + flowLayoutUtil.constants.JOIN_GAP;
  if (!joinMovedRight || !blocksContinuation) {
    return result;
  }
  return propagateToContainers({
    stepName: parent.name,
    dx,
    trigger,
    containers,
    previousJoins,
    visibleNames,
    result: shiftDownstream({
      head: continuation,
      dx,
      visibleNames,
      result,
      trigger,
    }),
  });
}

function shiftDownstream({
  head,
  dx,
  visibleNames,
  result,
  trigger,
}: {
  head: Step;
  dx: number;
  visibleNames: Set<string>;
  result: ShiftResult;
  trigger: FlowTrigger;
}): ShiftResult {
  const resolved = flowLayoutUtil.resolveStepPositions({
    trigger,
    stepPositions: result.positions,
  }).steps;
  const names = flowStructureUtil
    .getAllSteps(head)
    .map((step) => step.name)
    .filter((name) => visibleNames.has(name) && !isNil(resolved[name]));
  const moved = Object.fromEntries(
    names.map((name) => [
      name,
      { x: resolved[name].x + dx, y: resolved[name].y },
    ]),
  );
  return {
    positions: { ...result.positions, ...moved },
    names: [...new Set([...result.names, ...names])],
  };
}

function isOverlapped({
  chain,
  next,
  positions,
  trigger,
}: {
  chain: Step[];
  next: Step;
  positions: StepPositions;
  trigger: FlowTrigger;
}): boolean {
  const resolved = flowLayoutUtil.resolveStepPositions({
    trigger,
    stepPositions: positions,
  }).steps;
  const nextPosition = resolved[next.name];
  if (isNil(nextPosition)) {
    return false;
  }
  const nextBox = toBox({
    position: nextPosition,
    width: flowLayoutUtil.constants.NODE,
    height: flowLayoutUtil.getStepHeight(next),
  });
  return chain.some((step) => {
    const position = resolved[step.name];
    if (isNil(position)) {
      return false;
    }
    const footprint = toBox({
      position,
      width: flowLayoutUtil.constants.PITCH,
      height: flowLayoutUtil.getStepHeight(step),
    });
    return boxesIntersect({ a: footprint, b: nextBox });
  });
}

function getInsertedChainEndingAt({
  exit,
  trigger,
  insertedNames,
}: {
  exit: Step;
  trigger: FlowTrigger;
  insertedNames: Set<string>;
}): Step[] {
  const previous = findPreviousInChain({ trigger, stepName: exit.name });
  if (isNil(previous) || !insertedNames.has(previous.name)) {
    return [exit];
  }
  return [
    ...getInsertedChainEndingAt({ exit: previous, trigger, insertedNames }),
    exit,
  ];
}

function findPreviousInChain({
  trigger,
  stepName,
}: {
  trigger: FlowTrigger;
  stepName: string;
}): Step | undefined {
  return flowStructureUtil
    .getAllSteps(trigger)
    .find((step) => step.nextAction?.name === stepName);
}

function buildContainers(trigger: FlowTrigger): Map<string, string | null> {
  return new Map(collectContainers({ head: trigger, parentName: null }));
}

function collectContainers({
  head,
  parentName,
}: {
  head: Step | undefined;
  parentName: string | null;
}): [string, string | null][] {
  if (isNil(head)) {
    return [];
  }
  return [
    [head.name, parentName],
    ...getVisibleChildHeads(head).flatMap((childHead) =>
      collectContainers({ head: childHead, parentName: head.name }),
    ),
    ...collectContainers({ head: head.nextAction, parentName }),
  ];
}

function getVisibleChildHeads(step: Step): FlowAction[] {
  if (step.type === FlowActionType.LOOP_ON_ITEMS) {
    return isNil(step.firstLoopAction) ? [] : [step.firstLoopAction];
  }
  if (flowStructureUtil.isBranchedAction(step)) {
    return step.settings.branches
      .map((_, index) => step.children[index])
      .filter((child): child is FlowAction => !isNil(child));
  }
  if (flowStructureUtil.hasContinueOnFailureBranches(step)) {
    return sharedFlowCanvasUtils
      .getContinueOnFailureBranchPair(step)
      .filter((branch): branch is FlowAction => !isNil(branch));
  }
  return [];
}

function pickPositions({
  positions,
  names,
}: {
  positions: StepPositions;
  names: string[];
}): StepPositions {
  return Object.fromEntries(
    names
      .filter((name) => !isNil(positions[name]))
      .map((name) => [name, positions[name]]),
  );
}

function snapPosition(position: StepCanvasPosition): StepCanvasPosition {
  return {
    x: flowLayoutUtil.snap(position.x),
    y: flowLayoutUtil.snap(position.y),
  };
}

function isSamePosition({
  a,
  b,
}: {
  a: StepCanvasPosition | undefined;
  b: StepCanvasPosition | undefined;
}): boolean {
  return !isNil(a) && !isNil(b) && a.x === b.x && a.y === b.y;
}

function isEmptyMap(positions: StepPositions): boolean {
  return Object.keys(positions).length === 0;
}

function toBox({
  position,
  width,
  height,
}: {
  position: StepCanvasPosition;
  width: number;
  height: number;
}): Box {
  return {
    left: position.x,
    right: position.x + width,
    top: position.y,
    bottom: position.y + height,
  };
}

function boxesIntersect({ a, b }: { a: Box; b: Box }): boolean {
  return (
    a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
  );
}

export const stepPositionUtils = {
  computeDragPositions,
  computeTidyUp,
  computeInsertFollowUp,
  getDropTargets,
  getDropTargetState,
  snapPosition,
};

export type DropTargetState = 'none' | 'idle' | 'armed' | 'fading';

type Offset = {
  dx: number;
  dy: number;
};

type Box = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

type ShiftResult = {
  positions: StepPositions;
  names: string[];
};
