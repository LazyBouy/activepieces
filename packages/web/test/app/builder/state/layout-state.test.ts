// @vitest-environment jsdom
import {
  FlowOperationType,
  flowLayoutUtil,
  flowStructureUtil,
  RouterAction,
  StepLocationRelativeToParent,
  StepPositions,
} from '@activepieces/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  code,
  createTestBuilderStore,
  pieceTrigger,
  router,
  sentOperations,
  SERVER_VERSION,
  settle,
} from './builder-store-fixtures';

const update = vi.hoisted(() => vi.fn());

vi.mock('@/features/flows/api/flows-api', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@/features/flows/api/flows-api')
  >();
  return { flowsApi: { ...actual.flowsApi, update } };
});

describe('layout state: committing a drag', () => {
  beforeEach(() => {
    update.mockResolvedValue({ version: SERVER_VERSION });
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('sends one snapped UPDATE_STEP_POSITIONS per drag', async () => {
    const store = createTestBuilderStore({
      trigger: linearTrigger(),
      stepPositions: autoPositions(linearTrigger()),
    });

    store.getState().commitStepDrag({
      positions: {
        step_1: { x: 405, y: 250 },
        step_2: { x: 630, y: 249 },
      },
      dropTarget: null,
    });
    await settle();

    expect(sentOperations(update)).toEqual([
      {
        type: FlowOperationType.UPDATE_STEP_POSITIONS,
        request: {
          positions: {
            step_1: { x: 400, y: 256 },
            step_2: { x: 624, y: 256 },
          },
        },
      },
    ]);
    expect(store.getState().flowVersion.stepPositions.step_1).toEqual({
      x: 400,
      y: 256,
    });
  });

  it('sends nothing when the dragged steps did not move', async () => {
    const store = createTestBuilderStore({
      trigger: linearTrigger(),
      stepPositions: autoPositions(linearTrigger()),
    });

    store.getState().commitStepDrag({
      positions: { step_1: { x: 400, y: 240 } },
      dropTarget: null,
    });
    await settle();

    expect(update).not.toHaveBeenCalled();
  });

  it('materializes every visible step on the first drag of an unpositioned flow', async () => {
    const store = createTestBuilderStore({ trigger: linearTrigger() });

    store.getState().commitStepDrag({
      positions: { step_2: { x: 784, y: 400 } },
      dropTarget: null,
    });
    await settle();

    expect(sentOperations(update)).toEqual([
      {
        type: FlowOperationType.UPDATE_STEP_POSITIONS,
        request: {
          positions: {
            trigger: { x: 176, y: 240 },
            step_1: { x: 400, y: 240 },
            step_2: { x: 784, y: 400 },
          },
        },
      },
    ]);
  });

  it('refuses to write positions on a read-only canvas', async () => {
    const store = createTestBuilderStore({
      trigger: linearTrigger(),
      readonly: true,
    });

    store.getState().commitStepDrag({
      positions: { step_1: { x: 800, y: 400 } },
      dropTarget: null,
    });
    store.getState().tidyUp();
    store.getState().applyOperation({
      type: FlowOperationType.UPDATE_STEP_POSITIONS,
      request: { positions: { step_1: { x: 800, y: 400 } } },
    });
    await settle();

    expect(update).not.toHaveBeenCalled();
    expect(store.getState().flowVersion.stepPositions).toEqual({});
  });

  it('re-parents a single step dropped on a target with MOVE_ACTION and keeps the drop position', async () => {
    const trigger = branchingTrigger();
    const store = createTestBuilderStore({
      trigger,
      stepPositions: autoPositions(trigger),
    });

    store.getState().commitStepDrag({
      positions: { step_4: { x: 640, y: 352 } },
      dropTarget: {
        parentStepName: 'step_1',
        stepLocationRelativeToParent:
          StepLocationRelativeToParent.INSIDE_BRANCH,
        branchIndex: 1,
      },
    });
    await settle();

    const operations = sentOperations(update);
    expect(operations[0]).toEqual({
      type: FlowOperationType.MOVE_ACTION,
      request: {
        name: 'step_4',
        newParentStep: 'step_1',
        stepLocationRelativeToNewParent:
          StepLocationRelativeToParent.INSIDE_BRANCH,
        branchIndex: 1,
      },
    });
    expect(operations[1]).toMatchObject({
      type: FlowOperationType.UPDATE_STEP_POSITIONS,
      request: { positions: { step_4: { x: 640, y: 352 } } },
    });
    expect(operations).toHaveLength(2);
    const routerStep = flowStructureUtil.getStep(
      'step_1',
      store.getState().flowVersion.trigger,
    );
    expect(isRouter(routerStep) && routerStep.children[1]?.name).toBe('step_4');
    expect(store.getState().flowVersion.stepPositions.step_4).toEqual({
      x: 640,
      y: 352,
    });
  });

  it('never re-parents a multi-step drag', async () => {
    const trigger = branchingTrigger();
    const store = createTestBuilderStore({
      trigger,
      stepPositions: autoPositions(trigger),
    });

    store.getState().commitStepDrag({
      positions: {
        step_2: { x: 640, y: 96 },
        step_4: { x: 1200, y: 400 },
      },
      dropTarget: {
        parentStepName: 'step_1',
        stepLocationRelativeToParent:
          StepLocationRelativeToParent.INSIDE_BRANCH,
        branchIndex: 1,
      },
    });
    await settle();

    expect(sentOperations(update).map((operation) => operation.type)).toEqual([
      FlowOperationType.UPDATE_STEP_POSITIONS,
    ]);
  });

  it('ignores a drop target inside the dragged step', async () => {
    const trigger = branchingTrigger();
    const store = createTestBuilderStore({
      trigger,
      stepPositions: autoPositions(trigger),
    });

    store.getState().commitStepDrag({
      positions: { step_1: { x: 432, y: 240 } },
      dropTarget: {
        parentStepName: 'step_2',
        stepLocationRelativeToParent: StepLocationRelativeToParent.AFTER,
      },
    });
    await settle();

    expect(sentOperations(update).map((operation) => operation.type)).toEqual([
      FlowOperationType.UPDATE_STEP_POSITIONS,
    ]);
  });
});

describe('layout state: insert follow-ups', () => {
  beforeEach(() => {
    update.mockResolvedValue({ version: SERVER_VERSION });
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('places an inserted step and shifts the overlapped next step and everything after it by 224', async () => {
    const trigger = pieceTrigger(
      code({
        name: 'step_1',
        next: code({ name: 'step_2', next: code({ name: 'step_3' }) }),
      }),
    );
    const store = createTestBuilderStore({
      trigger,
      stepPositions: autoPositions(trigger),
    });

    store.getState().applyOperation({
      type: FlowOperationType.ADD_ACTION,
      request: {
        parentStep: 'step_1',
        stepLocationRelativeToParent: StepLocationRelativeToParent.AFTER,
        action: code({ name: 'step_4' }),
      },
    });
    await settle();

    expect(sentOperations(update)[1]).toEqual({
      type: FlowOperationType.UPDATE_STEP_POSITIONS,
      request: {
        positions: {
          step_4: { x: 624, y: 240 },
          step_2: { x: 848, y: 240 },
          step_3: { x: 1072, y: 240 },
        },
      },
    });
  });

  it('leaves a step that does not overlap where it is', async () => {
    const trigger = linearTrigger();
    const store = createTestBuilderStore({
      trigger,
      stepPositions: {
        ...autoPositions(trigger),
        step_2: { x: 1200, y: 240 },
      },
    });

    store.getState().applyOperation({
      type: FlowOperationType.ADD_ACTION,
      request: {
        parentStep: 'step_1',
        stepLocationRelativeToParent: StepLocationRelativeToParent.AFTER,
        action: code({ name: 'step_3' }),
      },
    });
    await settle();

    expect(sentOperations(update)[1]).toEqual({
      type: FlowOperationType.UPDATE_STEP_POSITIONS,
      request: { positions: { step_3: { x: 624, y: 240 } } },
    });
  });

  it('sends one follow-up for a batch of inserts such as a paste', async () => {
    const trigger = linearTrigger();
    const store = createTestBuilderStore({
      trigger,
      stepPositions: autoPositions(trigger),
    });

    store.getState().applyOperation({
      type: FlowOperationType.ADD_ACTION,
      request: {
        parentStep: 'step_1',
        stepLocationRelativeToParent: StepLocationRelativeToParent.AFTER,
        action: code({ name: 'step_3' }),
      },
    });
    store.getState().applyOperation({
      type: FlowOperationType.ADD_ACTION,
      request: {
        parentStep: 'step_3',
        stepLocationRelativeToParent: StepLocationRelativeToParent.AFTER,
        action: code({ name: 'step_4' }),
      },
    });
    await settle();

    const operations = sentOperations(update);
    expect(operations.map((operation) => operation.type)).toEqual([
      FlowOperationType.ADD_ACTION,
      FlowOperationType.ADD_ACTION,
      FlowOperationType.UPDATE_STEP_POSITIONS,
    ]);
    expect(operations[2]).toEqual({
      type: FlowOperationType.UPDATE_STEP_POSITIONS,
      request: {
        positions: {
          step_3: { x: 624, y: 240 },
          step_4: { x: 848, y: 240 },
          step_2: { x: 1072, y: 240 },
        },
      },
    });
  });

  it('places a duplicated step after its original and shifts what follows', async () => {
    const trigger = linearTrigger();
    const store = createTestBuilderStore({
      trigger,
      stepPositions: autoPositions(trigger),
    });

    store.getState().applyOperation({
      type: FlowOperationType.DUPLICATE_ACTION,
      request: { stepName: 'step_1' },
    });
    await settle();

    expect(sentOperations(update)[1]).toEqual({
      type: FlowOperationType.UPDATE_STEP_POSITIONS,
      request: {
        positions: {
          step_3: { x: 624, y: 240 },
          step_2: { x: 848, y: 240 },
        },
      },
    });
  });

  it('sends no follow-up while the flow has no stored positions', async () => {
    const store = createTestBuilderStore({ trigger: linearTrigger() });

    store.getState().applyOperation({
      type: FlowOperationType.ADD_ACTION,
      request: {
        parentStep: 'step_1',
        stepLocationRelativeToParent: StepLocationRelativeToParent.AFTER,
        action: code({ name: 'step_3' }),
      },
    });
    await settle();

    expect(sentOperations(update).map((operation) => operation.type)).toEqual([
      FlowOperationType.ADD_ACTION,
    ]);
  });

  it('places a step added from a dragged-out output at the release point', async () => {
    const store = createTestBuilderStore({ trigger: linearTrigger() });
    store.getState().setPendingStepPosition({
      selectorId: 'step_2-out-0',
      position: { x: 905, y: 503 },
    });
    store
      .getState()
      .setOpenedPieceSelectorStepNameOrAddButtonId('step_2-out-0');

    store.getState().applyOperation({
      type: FlowOperationType.ADD_ACTION,
      request: {
        parentStep: 'step_2',
        stepLocationRelativeToParent: StepLocationRelativeToParent.AFTER,
        action: code({ name: 'step_3' }),
      },
    });
    await settle();

    expect(sentOperations(update)[1]).toEqual({
      type: FlowOperationType.UPDATE_STEP_POSITIONS,
      request: {
        positions: {
          trigger: { x: 176, y: 240 },
          step_1: { x: 400, y: 240 },
          step_2: { x: 624, y: 240 },
          step_3: { x: 912, y: 496 },
        },
      },
    });
    expect(store.getState().pendingStepPosition).toBeNull();
  });

  it('forgets the release point once the selector closes', () => {
    const store = createTestBuilderStore({ trigger: linearTrigger() });
    store.getState().setPendingStepPosition({
      selectorId: 'step_2-out-0',
      position: { x: 905, y: 503 },
    });
    store
      .getState()
      .setOpenedPieceSelectorStepNameOrAddButtonId('step_2-out-0');
    expect(store.getState().pendingStepPosition).not.toBeNull();

    store.getState().setOpenedPieceSelectorStepNameOrAddButtonId(null);

    expect(store.getState().pendingStepPosition).toBeNull();
  });
});

describe('layout state: tidy-up', () => {
  beforeEach(() => {
    update.mockResolvedValue({ version: SERVER_VERSION });
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('sends one operation with the tidy-up layout of every visible step and keeps the trigger in place', async () => {
    const trigger = branchingTrigger();
    const stepPositions: StepPositions = {
      ...autoPositions(trigger),
      trigger: { x: 48, y: 64 },
      step_2: { x: 1600, y: 960 },
    };
    const store = createTestBuilderStore({ trigger, stepPositions });

    store.getState().tidyUp();
    await settle();

    const expected = flowLayoutUtil.tidyUp({ trigger, stepPositions });
    expect(sentOperations(update)).toEqual([
      {
        type: FlowOperationType.UPDATE_STEP_POSITIONS,
        request: { positions: expected },
      },
    ]);
    expect(expected.trigger).toEqual({ x: 48, y: 64 });
    expect(Object.keys(expected).sort()).toEqual(
      flowLayoutUtil
        .getVisibleSteps({ trigger })
        .map((step) => step.name)
        .sort(),
    );
  });

  it('sends nothing when the flow is already tidy', async () => {
    const trigger = branchingTrigger();
    const store = createTestBuilderStore({
      trigger,
      stepPositions: autoPositions(trigger),
    });

    store.getState().tidyUp();
    await settle();

    expect(update).not.toHaveBeenCalled();
  });
});

function linearTrigger() {
  return pieceTrigger(code({ name: 'step_1', next: code({ name: 'step_2' }) }));
}

function branchingTrigger() {
  return pieceTrigger(
    router({
      name: 'step_1',
      branches: [
        code({ name: 'step_2', next: code({ name: 'step_3' }) }),
        null,
      ],
      next: code({ name: 'step_4' }),
    }),
  );
}

function autoPositions(trigger: ReturnType<typeof pieceTrigger>) {
  return flowLayoutUtil.computeAutoLayout({ trigger }).steps;
}

function isRouter(step: unknown): step is RouterAction {
  return (
    typeof step === 'object' &&
    step !== null &&
    'children' in step &&
    Array.isArray(step.children)
  );
}
