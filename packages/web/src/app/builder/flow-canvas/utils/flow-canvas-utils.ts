import { isNil } from '@activepieces/core-utils';
import {
  BranchExecutionType,
  FlowActionType,
  FlowOperationType,
  FlowRun,
  FlowTriggerType,
  flowCanvasUtils as sharedFlowCanvasUtils,
  flowLayoutUtil,
  flowStructureUtil,
  FlowVersion,
  Note,
  NoteColorVariant,
  Step,
  StepCanvasOutput,
  StepLocationRelativeToParent,
  FlowTrigger,
} from '@activepieces/shared';

import { flowRunUtils } from '@/features/flow-runs';
import { NEW_FLOW_QUERY_PARAM } from '@/lib/route-utils';

import {
  ApButtonData,
  ApEdgeRunCheck,
  ApEdgeType,
  ApFlowEdge,
  ApGraph,
  ApJoinNode,
  ApNodeType,
  ApNoteNode,
  ApOutputLabelKind,
  ApStepNode,
  ApStepOutput,
} from './types';

function createFlowGraph({
  version,
  notes,
  readonly,
}: {
  version: FlowVersion;
  notes: Note[];
  readonly: boolean;
}): ApGraph {
  const { trigger } = version;
  const layout = flowLayoutUtil.resolveStepPositions({
    trigger,
    stepPositions: version.stepPositions,
  });
  const edges = buildChainEdges({ head: trigger, exit: { type: 'stub' } });
  const stubs = getVisibleStubs({ trigger });
  const steps = flowLayoutUtil.getVisibleSteps({ trigger });
  const stepNodes = steps.map((step) =>
    createStepNode({ step, layout, edges, stubs, readonly }),
  );
  const joinNodes = steps
    .filter((step) => flowLayoutUtil.hasJoin(step))
    .map((step) => createJoinNode({ step, layout, stubs }));
  return {
    nodes: [...buildNotesGraph(notes), ...stepNodes, ...joinNodes],
    edges,
  };
}

function createStepNode({
  step,
  layout,
  edges,
  stubs,
  readonly,
}: {
  step: Step;
  layout: ReturnType<typeof flowLayoutUtil.resolveStepPositions>;
  edges: ApFlowEdge[];
  stubs: StepCanvasStubs;
  readonly: boolean;
}): ApStepNode {
  const outputs = flowLayoutUtil.getStepOutputs(step);
  const height = flowLayoutUtil.getNodeHeight({ outputCount: outputs.length });
  const isTrigger = flowStructureUtil.isTrigger(step.type);
  return {
    id: step.name,
    type: ApNodeType.STEP,
    position: layout.steps[step.name],
    data: {
      step,
      height,
      outputs: outputs.map((output, index) =>
        createStepOutput({
          step,
          output,
          offset: flowLayoutUtil.getOutputOffset({
            outputCount: outputs.length,
            index,
          }),
          hasStub: stubs.steps.has(`${step.name}/${output.id}`),
        }),
      ),
      hasInput: !isTrigger,
      hasIncomingEdge: edges.some((edge) => edge.target === step.name),
    },
    selectable: !isTrigger,
    draggable: !readonly,
    zIndex: STEP_Z_INDEX,
    style: INTERACTIVE_NODE_STYLE,
  };
}

function createStepOutput({
  step,
  output,
  offset,
  hasStub,
}: {
  step: Step;
  output: StepCanvasOutput;
  offset: number;
  hasStub: boolean;
}): ApStepOutput {
  const branch = flowStructureUtil.isBranchedAction(step)
    ? step.settings.branches[output.branchIndex ?? -1]
    : undefined;
  return {
    id: output.id,
    offset,
    labelKind: getOutputLabelKind({ step, output }),
    branchName: branch?.branchName ?? null,
    branchIndex: output.branchIndex ?? null,
    insertLocation: toInsertLocation({ parentStepName: step.name, output }),
    hasStub,
  };
}

function getOutputLabelKind({
  step,
  output,
}: {
  step: Step;
  output: StepCanvasOutput;
}): ApOutputLabelKind | null {
  if (flowStructureUtil.isBranchedAction(step)) {
    const branch = step.settings.branches[output.branchIndex ?? -1];
    return branch?.branchType === BranchExecutionType.FALLBACK
      ? 'fallback'
      : 'branch';
  }
  switch (output.location) {
    case StepLocationRelativeToParent.INSIDE_LOOP:
      return 'loop';
    case StepLocationRelativeToParent.INSIDE_ON_SUCCESS_BRANCH:
      return 'success';
    case StepLocationRelativeToParent.INSIDE_ON_FAILURE_BRANCH:
      return 'failure';
    case StepLocationRelativeToParent.AFTER:
      return step.type === FlowActionType.LOOP_ON_ITEMS ? 'done' : null;
    case StepLocationRelativeToParent.INSIDE_BRANCH:
      return 'branch';
  }
}

function createJoinNode({
  step,
  layout,
  stubs,
}: {
  step: Step;
  layout: ReturnType<typeof flowLayoutUtil.resolveStepPositions>;
  stubs: StepCanvasStubs;
}): ApJoinNode {
  return {
    id: getJoinNodeId(step.name),
    type: ApNodeType.JOIN,
    position: layout.joins[step.name],
    data: {
      stepName: step.name,
      stub: stubs.joins.has(step.name)
        ? {
            parentStepName: step.name,
            stepLocationRelativeToParent: StepLocationRelativeToParent.AFTER,
          }
        : null,
    },
    selectable: false,
    draggable: false,
    zIndex: STEP_Z_INDEX,
    style: INTERACTIVE_NODE_STYLE,
  };
}

function buildChainEdges({
  head,
  exit,
}: {
  head: Step;
  exit: ChainExit;
}): ApFlowEdge[] {
  const chain = getChain(head);
  return chain.flatMap((step, index) => {
    const next = chain[index + 1];
    const childEdges = buildChildEdges(step);
    const source = getStepExit(step);
    const insertLocation: ApButtonData = {
      parentStepName: step.name,
      stepLocationRelativeToParent: StepLocationRelativeToParent.AFTER,
    };
    const sourceOutput = getExitSourceOutput(step);
    if (!isNil(next)) {
      return [
        ...childEdges,
        createEdge({
          source,
          target: next.name,
          insertLocation,
          sourceStepName: step.name,
          targetRunCheck: { kind: 'step', stepName: next.name },
          sourceOutput,
        }),
      ];
    }
    switch (exit.type) {
      case 'stub':
        return childEdges;
      case 'join':
        return [
          ...childEdges,
          createEdge({
            source,
            target: getJoinNodeId(exit.stepName),
            insertLocation,
            sourceStepName: step.name,
            targetRunCheck: { kind: 'step', stepName: step.name },
            sourceOutput,
          }),
        ];
      case 'loop':
        return [
          ...childEdges,
          createEdge({
            source,
            target: exit.stepName,
            insertLocation,
            sourceStepName: step.name,
            targetRunCheck: { kind: 'step', stepName: exit.stepName },
            sourceOutput,
          }),
        ];
    }
  });
}

function buildChildEdges(step: Step): ApFlowEdge[] {
  if (step.type === FlowActionType.LOOP_ON_ITEMS) {
    if (isNil(step.firstLoopAction)) {
      return [];
    }
    return [
      createEdge({
        source: { nodeId: step.name, handleId: LOOP_OUTPUT_ID },
        target: step.firstLoopAction.name,
        insertLocation: {
          parentStepName: step.name,
          stepLocationRelativeToParent:
            StepLocationRelativeToParent.INSIDE_LOOP,
        },
        sourceStepName: step.name,
        targetRunCheck: { kind: 'step', stepName: step.firstLoopAction.name },
        sourceOutput: { stepName: step.name, isLoopOutput: true },
      }),
      ...buildChainEdges({
        head: step.firstLoopAction,
        exit: { type: 'loop', stepName: step.name },
      }),
    ];
  }
  if (!flowLayoutUtil.hasJoin(step)) {
    return [];
  }
  const heads = getJoinedBranchHeads(step);
  return flowLayoutUtil.getStepOutputs(step).flatMap((output, index) => {
    const head = heads[index];
    const insertLocation = toInsertLocation({
      parentStepName: step.name,
      output,
    });
    const branchCheck = getBranchRunCheck({ step, output });
    const sourceOutput =
      output.location === StepLocationRelativeToParent.INSIDE_ON_SUCCESS_BRANCH
        ? { stepName: step.name, isLoopOutput: false }
        : null;
    if (isNil(head)) {
      return [
        createEdge({
          source: { nodeId: step.name, handleId: output.id },
          target: getJoinNodeId(step.name),
          insertLocation,
          sourceStepName: step.name,
          targetRunCheck: branchCheck,
          sourceOutput,
        }),
      ];
    }
    return [
      createEdge({
        source: { nodeId: step.name, handleId: output.id },
        target: head.name,
        insertLocation,
        sourceStepName: step.name,
        targetRunCheck: { kind: 'step', stepName: head.name },
        sourceOutput,
      }),
      ...buildChainEdges({
        head,
        exit: { type: 'join', stepName: step.name },
      }),
    ];
  });
}

function getBranchRunCheck({
  step,
  output,
}: {
  step: Step;
  output: StepCanvasOutput;
}): ApEdgeRunCheck {
  if (flowStructureUtil.isBranchedAction(step)) {
    return {
      kind: 'branch',
      stepName: step.name,
      branchIndex: output.branchIndex ?? 0,
    };
  }
  return {
    kind: 'cof-branch',
    stepName: step.name,
    onFailure:
      output.location === StepLocationRelativeToParent.INSIDE_ON_FAILURE_BRANCH,
  };
}

function getJoinedBranchHeads(step: Step): (Step | undefined)[] {
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

function getStepExit(step: Step): EdgeEndpoint {
  if (flowLayoutUtil.hasJoin(step)) {
    return { nodeId: getJoinNodeId(step.name), handleId: JOIN_SOURCE_ID };
  }
  return { nodeId: step.name, handleId: FIRST_OUTPUT_ID };
}

function getExitSourceOutput(step: Step): ApFlowEdge['data']['sourceOutput'] {
  if (flowLayoutUtil.hasJoin(step)) {
    return null;
  }
  return { stepName: step.name, isLoopOutput: false };
}

function createEdge({
  source,
  target,
  insertLocation,
  sourceStepName,
  targetRunCheck,
  sourceOutput,
}: {
  source: EdgeEndpoint;
  target: string;
  insertLocation: ApButtonData;
  sourceStepName: string;
  targetRunCheck: ApEdgeRunCheck;
  sourceOutput: ApFlowEdge['data']['sourceOutput'];
}): ApFlowEdge {
  const targetIsJoin = target.endsWith(JOIN_ID_SUFFIX);
  return {
    id: getOutputEdgeId({ nodeId: source.nodeId, outputId: source.handleId }),
    source: source.nodeId,
    sourceHandle: source.handleId,
    target,
    targetHandle: targetIsJoin ? JOIN_TARGET_ID : INPUT_HANDLE_ID,
    type: ApEdgeType.FLOW,
    selectable: false,
    deletable: false,
    focusable: false,
    zIndex: EDGE_Z_INDEX,
    data: {
      insertLocation,
      sourceStepName,
      targetRunCheck,
      targetIsJoin,
      sourceOutput,
    },
  };
}

function toInsertLocation({
  parentStepName,
  output,
}: {
  parentStepName: string;
  output: StepCanvasOutput;
}): ApButtonData {
  if (output.location === StepLocationRelativeToParent.INSIDE_BRANCH) {
    return {
      parentStepName,
      stepLocationRelativeToParent: output.location,
      branchIndex: output.branchIndex ?? 0,
    };
  }
  return {
    parentStepName,
    stepLocationRelativeToParent: output.location,
  };
}

function getVisibleStubs({
  trigger,
}: {
  trigger: FlowTrigger;
}): StepCanvasStubs {
  const isLoneEmptyTrigger =
    trigger.type === FlowTriggerType.EMPTY && isNil(trigger.nextAction);
  const stubs = isLoneEmptyTrigger ? [] : flowLayoutUtil.getStubs({ trigger });
  return {
    steps: new Set(
      stubs
        .filter((stub) => !stub.onJoin)
        .map((stub) => `${stub.stepName}/${stub.outputId}`),
    ),
    joins: new Set(
      stubs.filter((stub) => stub.onJoin).map((stub) => stub.stepName),
    ),
  };
}

function getChain(head: Step | undefined): Step[] {
  if (isNil(head)) {
    return [];
  }
  return [head, ...getChain(head.nextAction)];
}

function getJoinNodeId(stepName: string): string {
  return `${stepName}${JOIN_ID_SUFFIX}`;
}

function getOutputEdgeId({
  nodeId,
  outputId,
}: {
  nodeId: string;
  outputId: string;
}): string {
  return `${nodeId}-${outputId}-edge`;
}

function getOutputStubId({
  stepName,
  outputId,
}: {
  stepName: string;
  outputId: string;
}): string {
  return `${stepName}-${outputId}`;
}

function getJoinStubId(stepName: string): string {
  return `${getJoinNodeId(stepName)}-${JOIN_SOURCE_ID}`;
}

function buildNotesGraph(notes: Note[]): ApNoteNode[] {
  return notes.map((note) => ({
    id: note.id,
    type: ApNodeType.NOTE,
    draggable: false,
    className: NOTE_NODE_CLASS_NAME,
    position: note.position,
    zIndex: NOTE_Z_INDEX,
    data: {
      content: note.content,
      ownerId: note.ownerId,
      color: note.color,
      size: note.size,
    },
  }));
}

function createFocusStepInGraphParams(stepName: string) {
  return {
    nodes: [{ id: stepName }],
    duration: prefersReducedMotion() ? 0 : FOCUS_STEP_DURATION,
    maxZoom: 1,
    minZoom: 1,
  };
}

function prefersReducedMotion(): boolean {
  if (typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function createNoteDraft(): Note {
  return {
    id: '',
    content: '',
    createdAt: '',
    updatedAt: '',
    position: { x: 0, y: 0 },
    size: { ...NOTE_DEFAULT_SIZE },
    color: NOTE_DEFAULT_COLOR,
  };
}

function getAddStepParentName({
  trigger,
  selectedStep,
}: {
  trigger: FlowTrigger;
  selectedStep: string | null;
}): string {
  const selected = isNil(selectedStep)
    ? undefined
    : flowStructureUtil.getStep(selectedStep, trigger);
  if (!isNil(selected)) {
    return selected.name;
  }
  const mainChain = flowStructureUtil.getAllNextActionsWithoutChildren(trigger);
  return mainChain.at(-1)?.name ?? trigger.name;
}

function createAddOperationFromAddButtonData(data: ApButtonData) {
  if (
    data.stepLocationRelativeToParent ===
    StepLocationRelativeToParent.INSIDE_BRANCH
  ) {
    return {
      type: FlowOperationType.ADD_ACTION,
      actionLocation: {
        parentStep: data.parentStepName,
        stepLocationRelativeToParent: data.stepLocationRelativeToParent,
        branchIndex: data.branchIndex,
      },
    } as const;
  }
  return {
    type: FlowOperationType.ADD_ACTION,
    actionLocation: {
      parentStep: data.parentStepName,
      stepLocationRelativeToParent: data.stepLocationRelativeToParent,
    },
  } as const;
}

function getStepStatus(
  stepName: string | undefined,
  run: FlowRun | null,
  loopIndexes: Record<string, number>,
) {
  if (isNil(run) || isNil(stepName) || isNil(run.steps)) {
    return undefined;
  }
  const stepOutput = flowRunUtils.extractStepOutput(
    stepName,
    loopIndexes,
    run.steps,
  );
  return stepOutput?.status;
}

function determineInitiallySelectedStep(
  failedStepNameInRun: string | null,
  flowVersion: FlowVersion,
): string | null {
  const firstInvalidStep = flowStructureUtil
    .getAllSteps(flowVersion.trigger)
    .find((s) => !s.valid);
  const isNewFlow = window.location.search.includes(NEW_FLOW_QUERY_PARAM);
  if (failedStepNameInRun) {
    return failedStepNameInRun;
  }
  if (isNewFlow) {
    return null;
  }
  return firstInvalidStep?.name ?? 'trigger';
}

function doesSelectionRectangleExist() {
  return document.querySelector(`.${NODE_SELECTION_RECT_CLASS_NAME}`) !== null;
}

function getZoomContrastWeight(zoom: number): number {
  const progress = Math.min(1, Math.max(0, (1 - zoom) / ZOOM_CONTRAST_RANGE));
  return Math.round(progress ** ZOOM_CONTRAST_EXPONENT * 1000) / 1000;
}

const FOCUS_STEP_DURATION = 200;
const ZOOM_CONTRAST_RANGE = 0.8;
const ZOOM_CONTRAST_EXPONENT = 2.2;
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const NODE_SELECTION_RECT_CLASS_NAME = 'react-flow__nodesselection-rect';
const NOTE_DEFAULT_SIZE = { width: 240, height: 160 };
const NOTE_DEFAULT_COLOR = NoteColorVariant.YELLOW;
const INPUT_HANDLE_ID = 'in';
const FIRST_OUTPUT_ID = 'out-0';
const LOOP_OUTPUT_ID = 'out-1';
const JOIN_TARGET_ID = 'in';
const JOIN_SOURCE_ID = 'out';
const JOIN_ID_SUFFIX = '-join';
const NOTE_Z_INDEX = 0;
const EDGE_Z_INDEX = 40;
const STEP_Z_INDEX = 50;
const NOTE_NODE_CLASS_NAME = 'nopan';
const INTERACTIVE_NODE_STYLE: React.CSSProperties = { pointerEvents: 'all' };

export const flowCanvasUtils = {
  createFlowGraph,
  createFocusStepInGraphParams,
  createNoteDraft,
  getAddStepParentName,
  createAddOperationFromAddButtonData,
  getStepStatus,
  determineInitiallySelectedStep,
  doesSelectionRectangleExist,
  getZoomContrastWeight,
  getJoinNodeId,
  getOutputEdgeId,
  getOutputStubId,
  getJoinStubId,
  INPUT_HANDLE_ID,
  JOIN_TARGET_ID,
  JOIN_SOURCE_ID,
  NODE_SELECTION_RECT_CLASS_NAME,
  NOTE_DEFAULT_SIZE,
  NOTE_DEFAULT_COLOR,
};

type ChainExit =
  | { type: 'stub' }
  | { type: 'join'; stepName: string }
  | { type: 'loop'; stepName: string };

type EdgeEndpoint = {
  nodeId: string;
  handleId: string;
};

type StepCanvasStubs = {
  steps: Set<string>;
  joins: Set<string>;
};
