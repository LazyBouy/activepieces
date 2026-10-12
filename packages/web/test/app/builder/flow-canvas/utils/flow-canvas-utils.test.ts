// @vitest-environment jsdom
import {
  AiRouterAction,
  AiRouterMatchMode,
  BranchExecutionType,
  CodeAction,
  EmptyTrigger,
  FlowAction,
  FlowActionType,
  FlowOperationType,
  FlowTrigger,
  FlowTriggerType,
  FlowVersion,
  FlowVersionState,
  LoopOnItemsAction,
  NoteColorVariant,
  RouterAction,
  RouterExecutionType,
  StepLocationRelativeToParent,
  StepPositions,
} from '@activepieces/shared';
import { describe, expect, it, vi } from 'vitest';

import { flowCanvasUtils } from '@/app/builder/flow-canvas/utils/flow-canvas-utils';
import {
  ApButtonData,
  ApEdgeType,
  ApFlowEdge,
  ApGraph,
  ApJoinNode,
  ApNodeType,
  ApStepNode,
} from '@/app/builder/flow-canvas/utils/types';

vi.mock('@/features/flow-runs', () => ({
  flowRunUtils: {
    extractStepOutput: () => undefined,
    findLastStepWithStatus: () => null,
  },
}));

describe('flowCanvasUtils.createFlowGraph node types', () => {
  it('only creates step, join and note nodes and one edge type', () => {
    const graph = createGraph({
      trigger: emptyTrigger(
        code({
          name: 'step_1',
          next: router({
            name: 'step_2',
            branches: [{ name: 'Branch 1', head: code({ name: 'step_3' }) }],
            next: loop({ name: 'step_4', body: code({ name: 'step_5' }) }),
          }),
        }),
      ),
      notes: [note()],
    });

    expect(new Set(graph.nodes.map((node) => node.type))).toEqual(
      new Set([ApNodeType.STEP, ApNodeType.JOIN, ApNodeType.NOTE]),
    );
    expect(new Set(graph.edges.map((edge) => edge.type))).toEqual(
      new Set([ApEdgeType.FLOW]),
    );
  });

  it('makes steps draggable, the trigger unselectable and keeps notes on the dnd-kit path', () => {
    const graph = createGraph({
      trigger: emptyTrigger(code({ name: 'step_1' })),
      notes: [note()],
    });

    expect(stepNode(graph, 'trigger').draggable).toBe(true);
    expect(stepNode(graph, 'trigger').selectable).toBe(false);
    expect(stepNode(graph, 'step_1').draggable).toBe(true);
    expect(stepNode(graph, 'step_1').selectable).toBe(true);
    const noteNode = graph.nodes.find((node) => node.type === ApNodeType.NOTE);
    expect(noteNode).toMatchObject({
      id: 'note-1',
      draggable: false,
      className: 'nopan',
      position: { x: 10, y: 20 },
      zIndex: 0,
    });
  });

  it('keeps every node non-draggable on a read-only canvas', () => {
    const graph = createGraph({
      trigger: emptyTrigger(
        router({
          name: 'step_1',
          branches: [{ name: 'Branch 1', head: code({ name: 'step_2' }) }],
        }),
      ),
      notes: [note()],
      readonly: true,
    });

    expect(graph.nodes.every((node) => node.draggable === false)).toBe(true);
  });
});

describe('flowCanvasUtils.createFlowGraph positions', () => {
  it('lays an unpositioned flow out left to right from the layout origin', () => {
    const graph = createGraph({
      trigger: emptyTrigger(
        code({ name: 'step_1', next: code({ name: 'step_2' }) }),
      ),
    });

    expect(stepNode(graph, 'trigger').position).toEqual({ x: 176, y: 240 });
    expect(stepNode(graph, 'step_1').position).toEqual({ x: 400, y: 240 });
    expect(stepNode(graph, 'step_2').position).toEqual({ x: 624, y: 240 });
    expect(stepNode(graph, 'step_1').data.height).toBe(96);
  });

  it('uses stored positions verbatim and places unstored steps after their anchor', () => {
    const graph = createGraph({
      trigger: emptyTrigger(
        code({ name: 'step_1', next: code({ name: 'step_2' }) }),
      ),
      stepPositions: { step_1: { x: 800, y: 80 } },
    });

    expect(stepNode(graph, 'trigger').position).toEqual({ x: 176, y: 240 });
    expect(stepNode(graph, 'step_1').position).toEqual({ x: 800, y: 80 });
    expect(stepNode(graph, 'step_2').position).toEqual({ x: 1024, y: 80 });
  });

  it('places the join dot where the layout engine computes it', () => {
    const graph = createGraph({
      trigger: emptyTrigger(
        router({
          name: 'step_1',
          branches: [
            { name: 'Branch 1', head: code({ name: 'step_2' }) },
            { name: 'Otherwise', head: code({ name: 'step_3' }) },
          ],
          next: code({ name: 'step_4' }),
        }),
      ),
    });

    expect(joinNode(graph, 'step_1').position).toEqual({ x: 784, y: 280 });
    expect(joinNode(graph, 'step_1').draggable).toBe(false);
    expect(joinNode(graph, 'step_1').selectable).toBe(false);
  });
});

describe('flowCanvasUtils.createFlowGraph edges and insert locations', () => {
  it('connects a chain AFTER each source step and puts a stub on the last step', () => {
    const graph = createGraph({
      trigger: pieceTrigger(
        code({ name: 'step_1', next: code({ name: 'step_2' }) }),
      ),
    });

    expect(edgeSummaries(graph)).toEqual([
      {
        source: 'trigger',
        sourceHandle: 'out-0',
        target: 'step_1',
        targetHandle: 'in',
        insertLocation: after('trigger'),
        targetIsJoin: false,
      },
      {
        source: 'step_1',
        sourceHandle: 'out-0',
        target: 'step_2',
        targetHandle: 'in',
        insertLocation: after('step_1'),
        targetIsJoin: false,
      },
    ]);
    expect(stubOutputs(graph)).toEqual(['step_2/out-0']);
    expect(stepNode(graph, 'trigger').data.hasInput).toBe(false);
    expect(stepNode(graph, 'step_1').data.hasIncomingEdge).toBe(true);
  });

  it('wires router branches into the join and the join into the next step', () => {
    const graph = createGraph({
      trigger: emptyTrigger(
        router({
          name: 'step_1',
          branches: [
            { name: 'Branch 1', head: code({ name: 'step_2' }) },
            { name: 'Otherwise' },
          ],
          next: code({ name: 'step_3' }),
        }),
      ),
    });

    expect(edgeSummaries(graph)).toEqual([
      {
        source: 'trigger',
        sourceHandle: 'out-0',
        target: 'step_1',
        targetHandle: 'in',
        insertLocation: after('trigger'),
        targetIsJoin: false,
      },
      {
        source: 'step_1',
        sourceHandle: 'out-0',
        target: 'step_2',
        targetHandle: 'in',
        insertLocation: insideBranch('step_1', 0),
        targetIsJoin: false,
      },
      {
        source: 'step_2',
        sourceHandle: 'out-0',
        target: 'step_1-join',
        targetHandle: 'in',
        insertLocation: after('step_2'),
        targetIsJoin: true,
      },
      {
        source: 'step_1',
        sourceHandle: 'out-1',
        target: 'step_1-join',
        targetHandle: 'in',
        insertLocation: insideBranch('step_1', 1),
        targetIsJoin: true,
      },
      {
        source: 'step_1-join',
        sourceHandle: 'out',
        target: 'step_3',
        targetHandle: 'in',
        insertLocation: after('step_1'),
        targetIsJoin: false,
      },
    ]);
    expect(stubOutputs(graph)).toEqual(['step_3/out-0']);
    expect(joinNode(graph, 'step_1').data.stub).toBeNull();
  });

  it('gives the join a stub AFTER the router when nothing follows it', () => {
    const graph = createGraph({
      trigger: emptyTrigger(
        router({
          name: 'step_1',
          branches: [
            { name: 'Branch 1', head: code({ name: 'step_2' }) },
            { name: 'Otherwise' },
          ],
        }),
      ),
    });

    expect(joinNode(graph, 'step_1').data.stub).toEqual(after('step_1'));
    expect(stubOutputs(graph)).toEqual([]);
    expect(graph.edges.some((edge) => edge.source === 'step_1-join')).toBe(
      false,
    );
  });

  it('closes a loop body with an edge back to the loop and continues done on the main row', () => {
    const graph = createGraph({
      trigger: emptyTrigger(
        loop({
          name: 'step_1',
          body: code({ name: 'step_2', next: code({ name: 'step_3' }) }),
          next: code({ name: 'step_4' }),
        }),
      ),
    });

    expect(edgeSummaries(graph)).toEqual([
      {
        source: 'trigger',
        sourceHandle: 'out-0',
        target: 'step_1',
        targetHandle: 'in',
        insertLocation: after('trigger'),
        targetIsJoin: false,
      },
      {
        source: 'step_1',
        sourceHandle: 'out-1',
        target: 'step_2',
        targetHandle: 'in',
        insertLocation: {
          parentStepName: 'step_1',
          stepLocationRelativeToParent:
            StepLocationRelativeToParent.INSIDE_LOOP,
        },
        targetIsJoin: false,
      },
      {
        source: 'step_2',
        sourceHandle: 'out-0',
        target: 'step_3',
        targetHandle: 'in',
        insertLocation: after('step_2'),
        targetIsJoin: false,
      },
      {
        source: 'step_3',
        sourceHandle: 'out-0',
        target: 'step_1',
        targetHandle: 'in',
        insertLocation: after('step_3'),
        targetIsJoin: false,
      },
      {
        source: 'step_1',
        sourceHandle: 'out-0',
        target: 'step_4',
        targetHandle: 'in',
        insertLocation: after('step_1'),
        targetIsJoin: false,
      },
    ]);
    expect(edgeById(graph, 'step_1-out-1-edge').data.sourceOutput).toEqual({
      stepName: 'step_1',
      isLoopOutput: true,
    });
    expect(
      stepNode(graph, 'step_1').data.outputs.map((output) => output.labelKind),
    ).toEqual(['done', 'loop']);
  });

  it('puts stubs on an empty loop body and on a loop that ends the flow', () => {
    const graph = createGraph({
      trigger: emptyTrigger(loop({ name: 'step_1' })),
    });

    expect(stubOutputs(graph)).toEqual(['step_1/out-0', 'step_1/out-1']);
    expect(
      stepNode(graph, 'step_1').data.outputs.map(
        (output) => output.insertLocation,
      ),
    ).toEqual([
      after('step_1'),
      {
        parentStepName: 'step_1',
        stepLocationRelativeToParent: StepLocationRelativeToParent.INSIDE_LOOP,
      },
    ]);
  });

  it('gives continue-on-failure steps success and failure outputs that join', () => {
    const graph = createGraph({
      trigger: emptyTrigger(
        code({
          name: 'step_1',
          cof: true,
          onFailure: code({ name: 'step_2' }),
          next: code({ name: 'step_3' }),
        }),
      ),
    });

    const outputs = stepNode(graph, 'step_1').data.outputs;
    expect(outputs.map((output) => output.labelKind)).toEqual([
      'success',
      'failure',
    ]);
    expect(edgeById(graph, 'step_1-out-0-edge')).toMatchObject({
      target: 'step_1-join',
      data: {
        insertLocation: {
          parentStepName: 'step_1',
          stepLocationRelativeToParent:
            StepLocationRelativeToParent.INSIDE_ON_SUCCESS_BRANCH,
        },
        targetRunCheck: {
          kind: 'cof-branch',
          stepName: 'step_1',
          onFailure: false,
        },
      },
    });
    expect(edgeById(graph, 'step_1-out-1-edge')).toMatchObject({
      target: 'step_2',
      data: {
        insertLocation: {
          parentStepName: 'step_1',
          stepLocationRelativeToParent:
            StepLocationRelativeToParent.INSIDE_ON_FAILURE_BRANCH,
        },
      },
    });
    expect(edgeById(graph, 'step_1-join-out-edge').target).toBe('step_3');
  });

  it('treats a step with continue-on-failure off as a plain step', () => {
    const graph = createGraph({
      trigger: emptyTrigger(
        code({
          name: 'step_1',
          cof: false,
          onSuccess: code({ name: 'step_2' }),
        }),
      ),
    });

    expect(stepNode(graph, 'step_1').data.outputs).toHaveLength(1);
    expect(graph.nodes.some((node) => node.type === ApNodeType.JOIN)).toBe(
      false,
    );
    expect(graph.nodes.some((node) => node.id === 'step_2')).toBe(false);
    expect(stubOutputs(graph)).toEqual(['step_1/out-0']);
  });
});

describe('flowCanvasUtils.createFlowGraph with an AI router', () => {
  it('draws one labelled output per route with the fallback last', () => {
    const graph = createGraph({ trigger: emptyTrigger(aiRouter()) });
    const outputs = stepNode(graph, 'step_1').data.outputs;

    expect(
      outputs.map((output) => [output.labelKind, output.branchName]),
    ).toEqual([
      ['branch', 'Billing'],
      ['branch', 'Technical'],
      ['fallback', 'Otherwise'],
    ]);
    expect(outputs.map((output) => output.offset)).toEqual([32, 64, 96]);
    expect(stepNode(graph, 'step_1').data.height).toBe(128);
  });

  it('routes every empty route into the join with its branch index', () => {
    const graph = createGraph({ trigger: emptyTrigger(aiRouter()) });
    const joinEdges = graph.edges.filter((edge) => edge.data.targetIsJoin);

    expect(joinEdges.map((edge) => edge.data.insertLocation)).toEqual([
      insideBranch('step_1', 0),
      insideBranch('step_1', 1),
      insideBranch('step_1', 2),
    ]);
    expect(joinEdges.map((edge) => edge.data.targetRunCheck)).toEqual([
      { kind: 'branch', stepName: 'step_1', branchIndex: 0 },
      { kind: 'branch', stepName: 'step_1', branchIndex: 1 },
      { kind: 'branch', stepName: 'step_1', branchIndex: 2 },
    ]);
    expect(joinNode(graph, 'step_1').data.stub).toEqual(after('step_1'));
  });
});

describe('flowCanvasUtils.createFlowGraph with an empty trigger', () => {
  it('shows no stub on a new flow', () => {
    const graph = createGraph({ trigger: emptyTrigger() });

    expect(graph.nodes.map((node) => node.id)).toEqual(['trigger']);
    expect(graph.edges).toEqual([]);
    expect(stubOutputs(graph)).toEqual([]);
  });

  it('shows the trigger stub once a trigger is chosen', () => {
    const graph = createGraph({ trigger: pieceTrigger() });

    expect(stubOutputs(graph)).toEqual(['trigger/out-0']);
    expect(stepNode(graph, 'trigger').data.outputs[0].insertLocation).toEqual(
      after('trigger'),
    );
  });
});

describe('flowCanvasUtils.createAddOperationFromAddButtonData', () => {
  it('adds inside the branch the edge belongs to', () => {
    expect(
      flowCanvasUtils.createAddOperationFromAddButtonData(
        insideBranch('step_1', 2),
      ),
    ).toEqual({
      type: FlowOperationType.ADD_ACTION,
      actionLocation: {
        parentStep: 'step_1',
        stepLocationRelativeToParent:
          StepLocationRelativeToParent.INSIDE_BRANCH,
        branchIndex: 2,
      },
    });
  });

  it('adds after, inside a loop or inside a continue-on-failure branch without a branch index', () => {
    const locations: Exclude<
      StepLocationRelativeToParent,
      StepLocationRelativeToParent.INSIDE_BRANCH
    >[] = [
      StepLocationRelativeToParent.AFTER,
      StepLocationRelativeToParent.INSIDE_LOOP,
      StepLocationRelativeToParent.INSIDE_ON_SUCCESS_BRANCH,
      StepLocationRelativeToParent.INSIDE_ON_FAILURE_BRANCH,
    ];
    for (const location of locations) {
      expect(
        flowCanvasUtils.createAddOperationFromAddButtonData({
          parentStepName: 'step_1',
          stepLocationRelativeToParent: location,
        }),
      ).toEqual({
        type: FlowOperationType.ADD_ACTION,
        actionLocation: {
          parentStep: 'step_1',
          stepLocationRelativeToParent: location,
        },
      });
    }
  });
});

describe('flowCanvasUtils.getAddStepParentName', () => {
  it('adds after the selected step', () => {
    const trigger = emptyTrigger(
      code({ name: 'step_1', next: code({ name: 'step_2' }) }),
    );
    expect(
      flowCanvasUtils.getAddStepParentName({
        trigger,
        selectedStep: 'step_1',
      }),
    ).toBe('step_1');
  });

  it('adds after the last step of the main chain when nothing is selected', () => {
    const trigger = emptyTrigger(
      code({ name: 'step_1', next: code({ name: 'step_2' }) }),
    );
    expect(
      flowCanvasUtils.getAddStepParentName({ trigger, selectedStep: null }),
    ).toBe('step_2');
  });

  it('ignores a selection that is no longer in the flow', () => {
    const trigger = emptyTrigger(code({ name: 'step_1' }));
    expect(
      flowCanvasUtils.getAddStepParentName({
        trigger,
        selectedStep: 'deleted_step',
      }),
    ).toBe('step_1');
  });

  it('treats a selected empty trigger as no selection', () => {
    const trigger = emptyTrigger(
      code({ name: 'step_1', next: code({ name: 'step_2' }) }),
    );
    expect(
      flowCanvasUtils.getAddStepParentName({
        trigger,
        selectedStep: 'trigger',
      }),
    ).toBe('step_2');
  });

  it('adds after the trigger of an empty flow', () => {
    expect(
      flowCanvasUtils.getAddStepParentName({
        trigger: emptyTrigger(),
        selectedStep: null,
      }),
    ).toBe('trigger');
  });
});

describe('flowCanvasUtils.createNoteDraft', () => {
  it('starts a new note at the default size and colour', () => {
    const draft = flowCanvasUtils.createNoteDraft();
    expect(draft.size).toEqual({ width: 240, height: 160 });
    expect(draft.color).toBe(NoteColorVariant.YELLOW);
    expect(draft.content).toBe('');
  });
});

describe('flowCanvasUtils.getZoomContrastWeight', () => {
  it('keeps the 100% look at and above 100% zoom', () => {
    expect(flowCanvasUtils.getZoomContrastWeight(1)).toBe(0);
    expect(flowCanvasUtils.getZoomContrastWeight(2.5)).toBe(0);
  });

  it('reaches the full 20% look at and below 20% zoom', () => {
    expect(flowCanvasUtils.getZoomContrastWeight(0.2)).toBe(1);
    expect(flowCanvasUtils.getZoomContrastWeight(0.05)).toBe(1);
  });

  it('eases in with the 2.2 power between the two', () => {
    expect(flowCanvasUtils.getZoomContrastWeight(0.6)).toBe(0.218);
    expect(flowCanvasUtils.getZoomContrastWeight(0.9)).toBe(0.01);
  });
});

describe('flowCanvasUtils.createFocusStepInGraphParams', () => {
  it('pans to the step at 100% with a 200ms tween', () => {
    expect(flowCanvasUtils.createFocusStepInGraphParams('step_1')).toEqual({
      nodes: [{ id: 'step_1' }],
      duration: 200,
      minZoom: 1,
      maxZoom: 1,
    });
  });

  it('jumps instantly when the user prefers reduced motion', () => {
    vi.stubGlobal('matchMedia', () => createMediaQueryList(true));
    expect(
      flowCanvasUtils.createFocusStepInGraphParams('step_1').duration,
    ).toBe(0);
    vi.unstubAllGlobals();
  });
});

function createGraph({
  trigger,
  notes = [],
  stepPositions = {},
  readonly = false,
}: {
  trigger: FlowTrigger;
  notes?: FlowVersion['notes'];
  stepPositions?: StepPositions;
  readonly?: boolean;
}): ApGraph {
  return flowCanvasUtils.createFlowGraph({
    version: createFlowVersion({ trigger, stepPositions }),
    notes,
    readonly,
  });
}

function stepNode(graph: ApGraph, name: string): ApStepNode {
  const node = graph.nodes.find(
    (candidate): candidate is ApStepNode =>
      candidate.id === name && candidate.type === ApNodeType.STEP,
  );
  if (!node) {
    throw new Error(`missing step node ${name}`);
  }
  return node;
}

function joinNode(graph: ApGraph, stepName: string): ApJoinNode {
  const node = graph.nodes.find(
    (candidate): candidate is ApJoinNode =>
      candidate.type === ApNodeType.JOIN &&
      candidate.data.stepName === stepName,
  );
  if (!node) {
    throw new Error(`missing join node ${stepName}`);
  }
  return node;
}

function edgeById(graph: ApGraph, id: string): ApFlowEdge {
  const edge = graph.edges.find((candidate) => candidate.id === id);
  if (!edge) {
    throw new Error(`missing edge ${id}`);
  }
  return edge;
}

function edgeSummaries(graph: ApGraph) {
  return graph.edges.map((edge) => ({
    source: edge.source,
    sourceHandle: edge.sourceHandle,
    target: edge.target,
    targetHandle: edge.targetHandle,
    insertLocation: edge.data.insertLocation,
    targetIsJoin: edge.data.targetIsJoin,
  }));
}

function stubOutputs(graph: ApGraph): string[] {
  return graph.nodes
    .filter((node): node is ApStepNode => node.type === ApNodeType.STEP)
    .flatMap((node) =>
      node.data.outputs
        .filter((output) => output.hasStub)
        .map((output) => `${node.id}/${output.id}`),
    );
}

function after(parentStepName: string): ApButtonData {
  return {
    parentStepName,
    stepLocationRelativeToParent: StepLocationRelativeToParent.AFTER,
  };
}

function insideBranch(
  parentStepName: string,
  branchIndex: number,
): ApButtonData {
  return {
    parentStepName,
    stepLocationRelativeToParent: StepLocationRelativeToParent.INSIDE_BRANCH,
    branchIndex,
  };
}

function note(): FlowVersion['notes'][number] {
  return {
    id: 'note-1',
    content: 'hello',
    ownerId: null,
    color: NoteColorVariant.YELLOW,
    position: { x: 10, y: 20 },
    size: { width: 240, height: 160 },
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function code({
  name,
  next,
  cof,
  onSuccess,
  onFailure,
}: {
  name: string;
  next?: FlowAction;
  cof?: boolean;
  onSuccess?: FlowAction;
  onFailure?: FlowAction;
}): CodeAction {
  return {
    name,
    valid: true,
    displayName: name,
    lastUpdatedDate: NOW,
    type: FlowActionType.CODE,
    settings: {
      sourceCode: {
        code: 'export const code = async () => true;',
        packageJson: '{}',
      },
      input: {},
      errorHandlingOptions: {
        continueOnFailure: { value: cof ?? false },
        retryOnFailure: { value: false },
      },
    },
    nextAction: next,
    continueOnFailureBranches:
      onSuccess || onFailure ? { onSuccess, onFailure } : undefined,
  };
}

function loop({
  name,
  body,
  next,
}: {
  name: string;
  body?: FlowAction;
  next?: FlowAction;
}): LoopOnItemsAction {
  return {
    name,
    valid: true,
    displayName: name,
    lastUpdatedDate: NOW,
    type: FlowActionType.LOOP_ON_ITEMS,
    settings: { items: '{{trigger}}' },
    firstLoopAction: body,
    nextAction: next,
  };
}

function router({
  name,
  branches,
  next,
}: {
  name: string;
  branches: { name: string; head?: FlowAction }[];
  next?: FlowAction;
}): RouterAction {
  return {
    name,
    valid: true,
    displayName: name,
    lastUpdatedDate: NOW,
    type: FlowActionType.ROUTER,
    settings: {
      executionType: RouterExecutionType.EXECUTE_FIRST_MATCH,
      branches: branches.map((branch, index) =>
        index === branches.length - 1 && branch.name === 'Otherwise'
          ? {
              branchType: BranchExecutionType.FALLBACK,
              branchName: branch.name,
            }
          : {
              branchType: BranchExecutionType.CONDITION,
              branchName: branch.name,
              conditions: [[]],
            },
      ),
    },
    children: branches.map((branch) => branch.head ?? null),
    nextAction: next,
  };
}

function aiRouter(): AiRouterAction {
  return {
    name: 'step_1',
    valid: true,
    displayName: 'AI Router',
    lastUpdatedDate: NOW,
    type: FlowActionType.AI_ROUTER,
    settings: {
      text: '{{trigger.body.message}}',
      question: 'Which team?',
      matchMode: AiRouterMatchMode.BEST_MATCH,
      branches: [
        {
          branchType: BranchExecutionType.CONDITION,
          branchName: 'Billing',
          description: 'payments',
        },
        {
          branchType: BranchExecutionType.CONDITION,
          branchName: 'Technical',
          description: 'bugs',
        },
        {
          branchType: BranchExecutionType.FALLBACK,
          branchName: 'Otherwise',
          description: 'else',
        },
      ],
    },
    children: [null, null, null],
  };
}

function emptyTrigger(nextAction?: FlowAction): EmptyTrigger {
  return {
    name: 'trigger',
    valid: false,
    displayName: 'Select Trigger',
    type: FlowTriggerType.EMPTY,
    settings: {},
    lastUpdatedDate: NOW,
    nextAction,
  };
}

function pieceTrigger(nextAction?: FlowAction): FlowTrigger {
  return {
    name: 'trigger',
    valid: true,
    displayName: 'Catch Webhook',
    type: FlowTriggerType.PIECE,
    settings: {
      pieceName: '@activepieces/piece-webhook',
      pieceVersion: '0.1.42',
      triggerName: 'catch_webhook',
      input: {},
      propertySettings: {},
    },
    lastUpdatedDate: NOW,
    nextAction,
  };
}

function createFlowVersion({
  trigger,
  stepPositions,
}: {
  trigger: FlowTrigger;
  stepPositions: StepPositions;
}): FlowVersion {
  return {
    id: 'version-id',
    created: NOW,
    updated: NOW,
    flowId: 'flow-id',
    displayName: 'Test flow',
    trigger,
    updatedBy: null,
    valid: false,
    schemaVersion: null,
    agentIds: [],
    state: FlowVersionState.DRAFT,
    connectionIds: [],
    backupFiles: null,
    notes: [],
    stepPositions,
  };
}

function createMediaQueryList(matches: boolean): MediaQueryList {
  return {
    matches,
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  };
}

const NOW = '2026-01-01T00:00:00.000Z';
