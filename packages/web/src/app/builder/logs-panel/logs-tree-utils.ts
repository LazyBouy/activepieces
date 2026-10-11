import { isNil } from '@activepieces/core-utils';
import {
  FlowAction,
  FlowActionType,
  FlowTrigger,
  StepOutput,
  StepOutputStatus,
} from '@activepieces/shared';

function buildLogTree({
  trigger,
  steps,
}: {
  trigger: FlowTrigger;
  steps: Record<string, StepOutput>;
}): LogNode[] {
  return collectChain({ start: trigger, outputs: steps, loopPath: [] });
}

function flattenLogTree({
  nodes,
  isExpanded,
}: {
  nodes: LogNode[];
  isExpanded: (key: string) => boolean;
}): LogRow[] {
  return flattenLevel({ nodes, isExpanded, depth: 0, ancestorsContinue: [] });
}

function findPathKeys({
  nodes,
  matches,
}: {
  nodes: LogNode[];
  matches: (node: LogStepNode) => boolean;
}): string[] {
  return nodes.reduce<string[]>((found, node) => {
    const inChildren = findPathKeys({ nodes: node.children, matches });
    if (inChildren.length > 0) {
      return [node.key, ...inChildren];
    }
    if (node.kind === 'step' && matches(node)) {
      return [node.key];
    }
    return found;
  }, []);
}

function getFailedPathKeys(nodes: LogNode[]): Set<string> {
  const path = findPathKeys({
    nodes,
    matches: (node) => node.status === StepOutputStatus.FAILED,
  });
  return new Set(path.slice(0, -1));
}

function isRowSelected({
  row,
  selectedStep,
  loopsIndexes,
}: {
  row: LogRow;
  selectedStep: string | null;
  loopsIndexes: Record<string, number>;
}): boolean {
  return (
    row.kind === 'step' &&
    row.stepName === selectedStep &&
    row.loopPath.every(
      (entry) => (loopsIndexes[entry.loopName] ?? 0) === entry.index,
    )
  );
}

function findAdjacentStepRow({
  rows,
  currentKey,
  direction,
}: {
  rows: LogRow[];
  currentKey: string | null;
  direction: 1 | -1;
}): LogStepRow | null {
  const stepRows = rows.filter((row): row is LogStepRow => row.kind === 'step');
  if (stepRows.length === 0) {
    return null;
  }
  const currentIndex = stepRows.findIndex((row) => row.key === currentKey);
  if (currentIndex === -1) {
    return direction === 1 ? stepRows[0] : stepRows[stepRows.length - 1];
  }
  const nextIndex = Math.min(
    Math.max(currentIndex + direction, 0),
    stepRows.length - 1,
  );
  return stepRows[nextIndex];
}

function collectChain({
  start,
  outputs,
  loopPath,
}: {
  start: FlowAction | FlowTrigger | undefined;
  outputs: Record<string, StepOutput>;
  loopPath: LoopPathEntry[];
}): LogNode[] {
  const nodes: LogNode[] = [];
  let current: FlowAction | FlowTrigger | undefined = start;
  while (!isNil(current)) {
    nodes.push(...collectStep({ step: current, outputs, loopPath }));
    current = current.nextAction;
  }
  return nodes;
}

function collectStep({
  step,
  outputs,
  loopPath,
}: {
  step: FlowAction | FlowTrigger;
  outputs: Record<string, StepOutput>;
  loopPath: LoopPathEntry[];
}): LogNode[] {
  const output = outputs[step.name];
  const branchNodes = getBranches(step).flatMap((branch) =>
    collectChain({ start: branch, outputs, loopPath }),
  );
  if (isNil(output)) {
    return branchNodes;
  }
  const key = buildKey({ loopPath, name: step.name });
  const isLoop = step.type === FlowActionType.LOOP_ON_ITEMS;
  const stepNode: LogStepNode = {
    kind: 'step',
    key,
    stepName: step.name,
    displayName: step.displayName,
    status: output.status,
    duration: output.duration,
    loopPath,
    isLoop,
    children:
      step.type === FlowActionType.LOOP_ON_ITEMS
        ? buildIterations({
            loopKey: key,
            loopName: step.name,
            firstLoopAction: step.firstLoopAction,
            iterations: getIterations(output),
            loopPath,
          })
        : [],
  };
  return [stepNode, ...branchNodes];
}

function buildIterations({
  loopKey,
  loopName,
  firstLoopAction,
  iterations,
  loopPath,
}: {
  loopKey: string;
  loopName: string;
  firstLoopAction: FlowAction | undefined;
  iterations: Record<string, StepOutput>[];
  loopPath: LoopPathEntry[];
}): LogIterationNode[] {
  return iterations.map((iterationOutputs, index) => {
    const iterationPath = [...loopPath, { loopName, index }];
    return {
      kind: 'iteration',
      key: `${loopKey}#${index}`,
      loopName,
      index,
      loopPath: iterationPath,
      children: collectChain({
        start: firstLoopAction,
        outputs: iterationOutputs,
        loopPath: iterationPath,
      }),
    };
  });
}

function getBranches(step: FlowAction | FlowTrigger): FlowAction[] {
  switch (step.type) {
    case FlowActionType.ROUTER:
    case FlowActionType.AI_ROUTER:
      return step.children.filter(
        (child): child is FlowAction => !isNil(child),
      );
    case FlowActionType.CODE:
    case FlowActionType.PIECE:
      return [
        step.continueOnFailureBranches?.onSuccess,
        step.continueOnFailureBranches?.onFailure,
      ].filter((branch): branch is FlowAction => !isNil(branch));
    default:
      return [];
  }
}

function getIterations(output: StepOutput): Record<string, StepOutput>[] {
  if (output.type !== FlowActionType.LOOP_ON_ITEMS) {
    return [];
  }
  return output.output?.iterations ?? [];
}

function buildKey({
  loopPath,
  name,
}: {
  loopPath: LoopPathEntry[];
  name: string;
}): string {
  return [
    ...loopPath.map((entry) => `${entry.loopName}:${entry.index}`),
    name,
  ].join('/');
}

function flattenLevel({
  nodes,
  isExpanded,
  depth,
  ancestorsContinue,
}: {
  nodes: LogNode[];
  isExpanded: (key: string) => boolean;
  depth: number;
  ancestorsContinue: boolean[];
}): LogRow[] {
  return nodes.flatMap((node, index) => {
    const isLast = index === nodes.length - 1;
    const hasChildren = node.children.length > 0;
    const expanded = hasChildren && isExpanded(node.key);
    const row: LogRow =
      node.kind === 'step'
        ? {
            kind: 'step',
            key: node.key,
            stepName: node.stepName,
            displayName: node.displayName,
            status: node.status,
            duration: node.duration,
            loopPath: node.loopPath,
            isLoop: node.isLoop,
            depth,
            isLast,
            ancestorsContinue,
            hasChildren,
            expanded,
          }
        : {
            kind: 'iteration',
            key: node.key,
            loopName: node.loopName,
            index: node.index,
            loopPath: node.loopPath,
            depth,
            isLast,
            ancestorsContinue,
            hasChildren,
            expanded,
          };
    if (!expanded) {
      return [row];
    }
    return [
      row,
      ...flattenLevel({
        nodes: node.children,
        isExpanded,
        depth: depth + 1,
        ancestorsContinue: depth === 0 ? [] : [...ancestorsContinue, !isLast],
      }),
    ];
  });
}

export const logsTreeUtils = {
  buildLogTree,
  flattenLogTree,
  findPathKeys,
  getFailedPathKeys,
  isRowSelected,
  findAdjacentStepRow,
};

export type LoopPathEntry = {
  loopName: string;
  index: number;
};

export type LogStepNode = {
  kind: 'step';
  key: string;
  stepName: string;
  displayName: string;
  status: StepOutputStatus;
  duration: number | undefined;
  loopPath: LoopPathEntry[];
  isLoop: boolean;
  children: LogIterationNode[];
};

export type LogIterationNode = {
  kind: 'iteration';
  key: string;
  loopName: string;
  index: number;
  loopPath: LoopPathEntry[];
  children: LogNode[];
};

export type LogNode = LogStepNode | LogIterationNode;

type LogRowLayout = {
  key: string;
  loopPath: LoopPathEntry[];
  depth: number;
  isLast: boolean;
  ancestorsContinue: boolean[];
  hasChildren: boolean;
  expanded: boolean;
};

export type LogStepRow = LogRowLayout & {
  kind: 'step';
  stepName: string;
  displayName: string;
  status: StepOutputStatus;
  duration: number | undefined;
  isLoop: boolean;
};

export type LogIterationRow = LogRowLayout & {
  kind: 'iteration';
  loopName: string;
  index: number;
};

export type LogRow = LogStepRow | LogIterationRow;
