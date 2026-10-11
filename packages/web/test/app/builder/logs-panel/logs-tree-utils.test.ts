import {
  BranchExecutionType,
  CodeAction,
  FlowAction,
  FlowActionType,
  FlowTrigger,
  FlowTriggerType,
  GenericStepOutput,
  LoopOnItemsAction,
  LoopStepOutput,
  RouterAction,
  RouterExecutionType,
  StepOutput,
  StepOutputStatus,
} from '@activepieces/shared';
import { describe, expect, it } from 'vitest';

import {
  LogRow,
  logsTreeUtils,
} from '@/app/builder/logs-panel/logs-tree-utils';

const NOW = '2026-01-01T00:00:00.000Z';

function code({ name, next }: { name: string; next?: FlowAction }): CodeAction {
  return {
    name,
    valid: true,
    displayName: name,
    lastUpdatedDate: NOW,
    type: FlowActionType.CODE,
    settings: {
      sourceCode: { code: 'export const code = async () => true;', packageJson: '{}' },
      input: {},
      errorHandlingOptions: {
        continueOnFailure: { value: true },
        retryOnFailure: { value: false },
      },
    },
    nextAction: next,
  };
}

function router({
  name,
  branches,
  next,
}: {
  name: string;
  branches: (FlowAction | null)[];
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
      branches: branches.map((_, index) =>
        index === branches.length - 1
          ? { branchType: BranchExecutionType.FALLBACK, branchName: 'Otherwise' }
          : {
              branchType: BranchExecutionType.CONDITION,
              branchName: `Branch ${index + 1}`,
              conditions: [[]],
            },
      ),
    },
    children: branches,
    nextAction: next,
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

function loop({
  name,
  first,
  next,
}: {
  name: string;
  first?: FlowAction;
  next?: FlowAction;
}): LoopOnItemsAction {
  return {
    name,
    valid: true,
    displayName: name,
    lastUpdatedDate: NOW,
    type: FlowActionType.LOOP_ON_ITEMS,
    settings: { items: '{{step_1}}' },
    firstLoopAction: first,
    nextAction: next,
  };
}

function withFailureBranch({
  action,
  onFailure,
}: {
  action: FlowAction;
  onFailure: FlowAction;
}): FlowAction {
  if (action.type !== FlowActionType.CODE) {
    return action;
  }
  return { ...action, continueOnFailureBranches: { onFailure } };
}

function output({
  status = StepOutputStatus.SUCCEEDED,
  duration = 10,
}: {
  status?: StepOutputStatus;
  duration?: number;
} = {}): StepOutput {
  return new GenericStepOutput({
    type: FlowActionType.CODE,
    status,
    input: {},
    duration,
  });
}

function loopOutput(iterations: Record<string, StepOutput>[]): StepOutput {
  return new LoopStepOutput({
    type: FlowActionType.LOOP_ON_ITEMS,
    status: StepOutputStatus.SUCCEEDED,
    input: {},
    output: { item: 1, index: 0, iterations },
  });
}

const trigger = pieceTrigger(
  code({
    name: 'step_1',
    next: loop({
      name: 'step_2',
      first: code({ name: 'step_3', next: code({ name: 'step_4' }) }),
      next: router({
        name: 'step_5',
        branches: [code({ name: 'step_6' }), null],
        next: withFailureBranch({
          action: code({ name: 'step_7', next: code({ name: 'step_9' }) }),
          onFailure: code({ name: 'step_8' }),
        }),
      }),
    }),
  }),
);

const steps: Record<string, StepOutput> = {
  trigger: output({ duration: 2 }),
  step_1: output({ duration: 12 }),
  step_2: loopOutput([
    { step_3: output(), step_4: output() },
    {
      step_3: output(),
      step_4: output({ status: StepOutputStatus.FAILED, duration: 30 }),
    },
  ]),
  step_5: output(),
  step_6: output(),
  step_7: output({ status: StepOutputStatus.FAILED }),
  step_8: output({ status: StepOutputStatus.RUNNING }),
};

function describeRows(rows: LogRow[]): string[] {
  return rows.map((row) =>
    row.kind === 'step'
      ? `${'  '.repeat(row.depth)}${row.stepName}`
      : `${'  '.repeat(row.depth)}#${row.index + 1}`,
  );
}

describe('logsTreeUtils.buildLogTree', () => {
  it('lists the steps that ran in depth-first order, flat through branches', () => {
    const tree = logsTreeUtils.buildLogTree({ trigger, steps });
    expect(tree.map((node) => node.key)).toEqual([
      'trigger',
      'step_1',
      'step_2',
      'step_5',
      'step_6',
      'step_7',
      'step_8',
    ]);
  });

  it('leaves out steps without output in this run', () => {
    const tree = logsTreeUtils.buildLogTree({ trigger, steps });
    expect(tree.some((node) => node.key === 'step_9')).toBe(false);
    expect(
      logsTreeUtils.buildLogTree({
        trigger,
        steps: { trigger: output(), step_1: output() },
      }),
    ).toHaveLength(2);
  });

  it('carries status, duration and the loop flag', () => {
    const [triggerNode, step1, step2] = logsTreeUtils.buildLogTree({
      trigger,
      steps,
    });
    expect(triggerNode).toMatchObject({
      kind: 'step',
      stepName: 'trigger',
      displayName: 'Catch Webhook',
      duration: 2,
      isLoop: false,
    });
    expect(step1).toMatchObject({ duration: 12, isLoop: false });
    expect(step2).toMatchObject({ isLoop: true });
  });

  it('nests one iteration per loop round with the steps that ran in it', () => {
    const loopNode = logsTreeUtils
      .buildLogTree({ trigger, steps })
      .find((node) => node.key === 'step_2');
    expect(loopNode?.children.map((node) => node.key)).toEqual([
      'step_2#0',
      'step_2#1',
    ]);
    const secondIteration = loopNode?.children[1];
    expect(secondIteration).toMatchObject({
      kind: 'iteration',
      loopName: 'step_2',
      index: 1,
    });
    expect(secondIteration?.children).toEqual([
      expect.objectContaining({
        key: 'step_2:1/step_3',
        stepName: 'step_3',
        loopPath: [{ loopName: 'step_2', index: 1 }],
      }),
      expect.objectContaining({
        key: 'step_2:1/step_4',
        status: StepOutputStatus.FAILED,
        duration: 30,
      }),
    ]);
  });

  it('handles nested loops', () => {
    const nestedTrigger = pieceTrigger(
      loop({
        name: 'outer',
        first: loop({ name: 'inner', first: code({ name: 'leaf' }) }),
      }),
    );
    const tree = logsTreeUtils.buildLogTree({
      trigger: nestedTrigger,
      steps: {
        trigger: output(),
        outer: loopOutput([
          { inner: loopOutput([{ leaf: output() }, { leaf: output() }]) },
        ]),
      },
    });
    const rows = logsTreeUtils.flattenLogTree({
      nodes: tree,
      isExpanded: () => true,
    });
    expect(describeRows(rows)).toEqual([
      'trigger',
      'outer',
      '  #1',
      '    inner',
      '      #1',
      '        leaf',
      '      #2',
      '        leaf',
    ]);
    const leaf = rows.find((row) => row.key === 'outer:0/inner:1/leaf');
    expect(leaf?.loopPath).toEqual([
      { loopName: 'outer', index: 0 },
      { loopName: 'inner', index: 1 },
    ]);
  });
});

describe('logsTreeUtils.flattenLogTree', () => {
  it('starts with loops collapsed', () => {
    const rows = logsTreeUtils.flattenLogTree({
      nodes: logsTreeUtils.buildLogTree({ trigger, steps }),
      isExpanded: () => false,
    });
    expect(describeRows(rows)).toEqual([
      'trigger',
      'step_1',
      'step_2',
      'step_5',
      'step_6',
      'step_7',
      'step_8',
    ]);
    expect(rows[2]).toMatchObject({ hasChildren: true, expanded: false });
  });

  it('shows iterations and their steps when expanded, with connector data', () => {
    const rows = logsTreeUtils.flattenLogTree({
      nodes: logsTreeUtils.buildLogTree({ trigger, steps }),
      isExpanded: () => true,
    });
    expect(describeRows(rows).slice(2, 9)).toEqual([
      'step_2',
      '  #1',
      '    step_3',
      '    step_4',
      '  #2',
      '    step_3',
      '    step_4',
    ]);
    const firstIteration = rows[3];
    const lastIteration = rows[6];
    expect(firstIteration).toMatchObject({ isLast: false, depth: 1 });
    expect(lastIteration).toMatchObject({ isLast: true, depth: 1 });
    expect(rows[4]).toMatchObject({
      depth: 2,
      isLast: false,
      ancestorsContinue: [true],
    });
    expect(rows[8]).toMatchObject({
      depth: 2,
      isLast: true,
      ancestorsContinue: [false],
    });
  });
});

describe('logsTreeUtils helpers', () => {
  const tree = logsTreeUtils.buildLogTree({ trigger, steps });

  it('opens the loop down to the failed step', () => {
    const keys = logsTreeUtils.getFailedPathKeys(tree);
    expect([...keys]).toEqual([]);
    const loopFailureTree = logsTreeUtils.buildLogTree({
      trigger,
      steps: { ...steps, step_7: output() },
    });
    expect([
      ...logsTreeUtils.getFailedPathKeys(loopFailureTree),
    ]).toEqual(['step_2', 'step_2#1']);
  });

  it('matches the selected row by step name and the loop indexes', () => {
    const rows = logsTreeUtils.flattenLogTree({
      nodes: tree,
      isExpanded: () => true,
    });
    const selectedKeys = rows
      .filter((row) =>
        logsTreeUtils.isRowSelected({
          row,
          selectedStep: 'step_4',
          loopsIndexes: { step_2: 1 },
        }),
      )
      .map((row) => row.key);
    expect(selectedKeys).toEqual(['step_2:1/step_4']);
    expect(
      rows.filter((row) =>
        logsTreeUtils.isRowSelected({
          row,
          selectedStep: 'step_1',
          loopsIndexes: { step_2: 1 },
        }),
      ),
    ).toHaveLength(1);
  });

  it('moves between step rows and skips iteration rows', () => {
    const rows = logsTreeUtils.flattenLogTree({
      nodes: tree,
      isExpanded: () => true,
    });
    expect(
      logsTreeUtils.findAdjacentStepRow({
        rows,
        currentKey: 'step_2',
        direction: 1,
      })?.key,
    ).toBe('step_2:0/step_3');
    expect(
      logsTreeUtils.findAdjacentStepRow({
        rows,
        currentKey: 'step_2:1/step_3',
        direction: -1,
      })?.key,
    ).toBe('step_2:0/step_4');
    expect(
      logsTreeUtils.findAdjacentStepRow({
        rows,
        currentKey: 'step_8',
        direction: 1,
      })?.key,
    ).toBe('step_8');
    expect(
      logsTreeUtils.findAdjacentStepRow({
        rows,
        currentKey: null,
        direction: 1,
      })?.key,
    ).toBe('trigger');
  });
});
