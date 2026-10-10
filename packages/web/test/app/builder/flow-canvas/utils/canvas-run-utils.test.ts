import {
  FlowActionType,
  FlowRun,
  FlowRunStatus,
  FlowTrigger,
  FlowTriggerType,
  GenericStepOutput,
  LoopStepOutput,
  RouterStepOutput,
  RunEnvironment,
  StepOutput,
  StepOutputStatus,
} from '@activepieces/shared';
import { describe, expect, it, vi } from 'vitest';

import { canvasRunUtils } from '@/app/builder/flow-canvas/utils/canvas-run-utils';

vi.mock('@/features/flow-runs', () => ({
  flowRunUtils: {
    extractStepOutput: (
      stepName: string,
      _loopsIndexes: Record<string, number>,
      steps: Record<string, StepOutput>,
    ) => steps[stepName],
  },
}));

vi.mock('@/features/pieces', () => ({
  pieceSelectorUtils: {
    isManualTrigger: ({ pieceName }: { pieceName: string }) =>
      pieceName === '@activepieces/piece-manual-trigger',
    isChatTrigger: () => false,
  },
}));

describe('canvasRunUtils.resolveRunVisual', () => {
  it('shows a success border and check, with the run count only above one', () => {
    expect(
      canvasRunUtils.resolveRunVisual({
        output: output({ status: StepOutputStatus.SUCCEEDED }),
        isSkipped: false,
        showsSampleData: false,
        runCount: 1,
      }),
    ).toEqual({
      border: 'success',
      corner: { kind: 'success', count: null },
      ring: null,
    });
    expect(
      canvasRunUtils.resolveRunVisual({
        output: output({ status: StepOutputStatus.SUCCEEDED }),
        isSkipped: false,
        showsSampleData: false,
        runCount: 4,
      }).corner,
    ).toEqual({ kind: 'success', count: 4 });
  });

  it('shows a danger border with the error message on failure', () => {
    expect(
      canvasRunUtils.resolveRunVisual({
        output: output({
          status: StepOutputStatus.FAILED,
          errorMessage: 'boom',
        }),
        isSkipped: false,
        showsSampleData: false,
        runCount: 1,
      }),
    ).toEqual({
      border: 'danger',
      corner: { kind: 'failed', tooltip: 'boom' },
      ring: null,
    });
  });

  it('shows the readable message of a structured piece error', () => {
    const structured = JSON.stringify({
      __apErrorVersion: 1,
      message: 'final failure',
      raw: 'Error: final failure\n    at Object.code',
    });
    expect(
      canvasRunUtils.resolveRunVisual({
        output: output({
          status: StepOutputStatus.FAILED,
          errorMessage: structured,
        }),
        isSkipped: false,
        showsSampleData: false,
        runCount: 1,
      }).corner,
    ).toEqual({ kind: 'failed', tooltip: 'final failure' });
  });

  it('shows the running ring fast while running and slow while paused', () => {
    const running = canvasRunUtils.resolveRunVisual({
      output: output({ status: StepOutputStatus.RUNNING }),
      isSkipped: false,
      showsSampleData: false,
      runCount: 1,
    });
    const paused = canvasRunUtils.resolveRunVisual({
      output: output({ status: StepOutputStatus.PAUSED }),
      isSkipped: false,
      showsSampleData: false,
      runCount: 1,
    });
    expect(running).toEqual({ border: 'none', corner: null, ring: 'running' });
    expect(paused).toEqual({
      border: 'none',
      corner: { kind: 'paused' },
      ring: 'paused',
    });
  });

  it('lets sample data override success and skipped override everything', () => {
    expect(
      canvasRunUtils.resolveRunVisual({
        output: output({ status: StepOutputStatus.SUCCEEDED }),
        isSkipped: false,
        showsSampleData: true,
        runCount: 1,
      }).border,
    ).toBe('pinned');
    expect(
      canvasRunUtils.resolveRunVisual({
        output: output({ status: StepOutputStatus.FAILED }),
        isSkipped: true,
        showsSampleData: false,
        runCount: 1,
      }),
    ).toEqual({ border: 'skipped', corner: { kind: 'skipped' }, ring: null });
  });

  it('keeps the idle look for a step without output in the run', () => {
    expect(
      canvasRunUtils.resolveRunVisual({
        output: undefined,
        isSkipped: false,
        showsSampleData: false,
        runCount: 0,
      }),
    ).toEqual({ border: 'idle', corner: null, ring: null });
  });
});

describe('canvasRunUtils draft status', () => {
  it('follows the existing draft badge order', () => {
    const base = {
      isValid: true,
      isBeingTested: false,
      hasError: false,
      lastTestDate: '2026-01-02',
      lastUpdatedDate: '2026-01-01',
    };
    expect(canvasRunUtils.getDraftStatus({ ...base, isValid: false })).toBe(
      'invalid',
    );
    expect(
      canvasRunUtils.getDraftStatus({ ...base, isBeingTested: true }),
    ).toBe('testing');
    expect(
      canvasRunUtils.getDraftStatus({ ...base, lastTestDate: undefined }),
    ).toBe('untested');
    expect(
      canvasRunUtils.getDraftStatus({
        ...base,
        lastUpdatedDate: '2026-01-03',
      }),
    ).toBe('needs-test');
    expect(canvasRunUtils.getDraftStatus({ ...base, hasError: true })).toBe(
      'failed',
    );
    expect(canvasRunUtils.getDraftStatus(base)).toBe('tested');
  });

  it('maps draft statuses to borders and corner icons', () => {
    const visual = (
      status: Parameters<typeof canvasRunUtils.resolveDraftVisual>[0]['status'],
    ) =>
      canvasRunUtils.resolveDraftVisual({
        status,
        isSkipped: false,
        errorMessage: 'bad input',
      });
    expect(visual('invalid')).toEqual({
      border: 'idle',
      corner: { kind: 'incomplete' },
      ring: null,
    });
    expect(visual('needs-test').border).toBe('warning');
    expect(visual('failed').corner).toEqual({
      kind: 'failed',
      tooltip: 'bad input',
    });
    expect(visual('tested')).toEqual({
      border: 'idle',
      corner: { kind: 'success', count: null },
      ring: null,
    });
    expect(visual('untested')).toEqual({
      border: 'idle',
      corner: null,
      ring: null,
    });
  });
});

describe('canvasRunUtils.isEdgeSuccessful', () => {
  it('needs a succeeded source and a target that ran, even if it failed', () => {
    const run = createRun({
      step_1: output({ status: StepOutputStatus.SUCCEEDED }),
      step_2: output({ status: StepOutputStatus.FAILED }),
    });
    expect(
      canvasRunUtils.isEdgeSuccessful({
        sourceStepName: 'step_1',
        targetRunCheck: { kind: 'step', stepName: 'step_2' },
        run,
        loopsIndexes: {},
      }),
    ).toBe(true);
    expect(
      canvasRunUtils.isEdgeSuccessful({
        sourceStepName: 'step_2',
        targetRunCheck: { kind: 'step', stepName: 'step_3' },
        run,
        loopsIndexes: {},
      }),
    ).toBe(false);
  });

  it('colours a router output only when its branch was taken, reading the engine 1-based branch index', () => {
    const run = createRun({ step_1: routerOutput([1]) });
    const isTaken = (branchIndex: number) =>
      canvasRunUtils.isEdgeSuccessful({
        sourceStepName: 'step_1',
        targetRunCheck: { kind: 'branch', stepName: 'step_1', branchIndex },
        run,
        loopsIndexes: {},
      });
    expect(isTaken(0)).toBe(false);
    expect(isTaken(1)).toBe(true);
  });
});

describe('canvasRunUtils counts', () => {
  it('counts array outputs and loop iterations but not empty ones', () => {
    expect(canvasRunUtils.getItemCount(arrayOutput([1, 2, 3]).output)).toBe(3);
    expect(canvasRunUtils.getItemCount([])).toBeNull();
    expect(canvasRunUtils.getItemCount({ a: 1 })).toBeNull();
    expect(canvasRunUtils.getLoopIterationCount(loopOutput([{}, {}]))).toBe(2);
    expect(canvasRunUtils.getLoopIterationCount(loopOutput([]))).toBeNull();
  });

  it('counts the iterations in which a loop body step produced output', () => {
    const trigger = triggerWithLoop();
    const run = createRun({
      step_1: loopOutput([
        { step_2: output({ status: StepOutputStatus.SUCCEEDED }) },
        {},
        { step_2: output({ status: StepOutputStatus.SUCCEEDED }) },
      ]),
      step_2: output({ status: StepOutputStatus.SUCCEEDED }),
    });
    expect(
      canvasRunUtils.getRunCount({
        stepName: 'step_2',
        trigger,
        run,
        loopsIndexes: {},
      }),
    ).toBe(2);
    expect(
      canvasRunUtils.getRunCount({
        stepName: 'step_1',
        trigger,
        run,
        loopsIndexes: {},
      }),
    ).toBe(3);
  });
});

describe('canvasRunUtils.isTriggerShowingSampleData', () => {
  it('applies to a piece trigger in a test run only', () => {
    const trigger = pieceTrigger('@activepieces/piece-webhook');
    const testRun = createRun({
      trigger: output({ status: StepOutputStatus.SUCCEEDED }),
    });
    expect(
      canvasRunUtils.isTriggerShowingSampleData({ trigger, run: testRun }),
    ).toBe(true);
    expect(
      canvasRunUtils.isTriggerShowingSampleData({
        trigger,
        run: { ...testRun, environment: RunEnvironment.PRODUCTION },
      }),
    ).toBe(false);
    expect(
      canvasRunUtils.isTriggerShowingSampleData({
        trigger: pieceTrigger('@activepieces/piece-manual-trigger'),
        run: testRun,
      }),
    ).toBe(false);
  });
});

function output({
  status,
  errorMessage,
}: {
  status: StepOutputStatus;
  errorMessage?: string;
}): StepOutput {
  return new GenericStepOutput({
    type: FlowActionType.CODE,
    status,
    input: {},
    errorMessage,
  });
}

function arrayOutput(items: unknown[]): StepOutput {
  return GenericStepOutput.create({
    type: FlowActionType.CODE,
    status: StepOutputStatus.SUCCEEDED,
    input: {},
    output: items,
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

function routerOutput(takenBranches: number[]): StepOutput {
  return new RouterStepOutput({
    type: FlowActionType.ROUTER,
    status: StepOutputStatus.SUCCEEDED,
    input: {},
    output: {
      branches: [0, 1].map((index) => ({
        branchIndex: index + 1,
        branchName: `Branch ${index + 1}`,
        evaluation: takenBranches.includes(index),
      })),
    },
  });
}

function createRun(steps: Record<string, StepOutput>): FlowRun {
  return {
    id: 'run-1',
    created: NOW,
    updated: NOW,
    projectId: 'project-1',
    flowId: 'flow-1',
    flowVersionId: 'version-1',
    status: FlowRunStatus.SUCCEEDED,
    environment: RunEnvironment.TESTING,
    steps,
    tags: [],
    startTime: NOW,
    failParentOnFailure: false,
    logsFileId: null,
    archivedAt: null,
  };
}

function pieceTrigger(pieceName: string): FlowTrigger {
  return {
    name: 'trigger',
    valid: true,
    displayName: 'Trigger',
    type: FlowTriggerType.PIECE,
    settings: {
      pieceName,
      pieceVersion: '0.1.0',
      triggerName: 'trigger',
      input: {},
      propertySettings: {},
    },
    lastUpdatedDate: NOW,
  };
}

function triggerWithLoop(): FlowTrigger {
  return {
    ...pieceTrigger('@activepieces/piece-webhook'),
    nextAction: {
      name: 'step_1',
      valid: true,
      displayName: 'Loop',
      lastUpdatedDate: NOW,
      type: FlowActionType.LOOP_ON_ITEMS,
      settings: { items: '{{trigger}}' },
      firstLoopAction: {
        name: 'step_2',
        valid: true,
        displayName: 'Body',
        lastUpdatedDate: NOW,
        type: FlowActionType.CODE,
        settings: {
          sourceCode: { code: '', packageJson: '{}' },
          input: {},
          errorHandlingOptions: {},
        },
      },
    },
  };
}

const NOW = '2026-01-01T00:00:00.000Z';
