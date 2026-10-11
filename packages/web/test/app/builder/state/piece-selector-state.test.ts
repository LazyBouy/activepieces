// @vitest-environment jsdom
import {
  FlowOperationType,
  FlowTrigger,
  FlowTriggerType,
  StepLocationRelativeToParent,
} from '@activepieces/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { flowCanvasUtils } from '@/app/builder/flow-canvas/utils/flow-canvas-utils';
import { pieceSelectorStateUtils } from '@/app/builder/state/piece-selector-state';
import { stepUtils } from '@/features/pieces/utils/step-utils';

import {
  code,
  createTestBuilderStore,
  pieceTrigger,
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

describe('piece panel openers', () => {
  it('opens next-step mode for an output stub with that output location', () => {
    const store = createTestBuilderStore({ trigger: linearTrigger() });
    const operation = flowCanvasUtils.createAddOperationFromAddButtonData({
      parentStepName: 'step_1',
      stepLocationRelativeToParent: StepLocationRelativeToParent.AFTER,
    });

    store.getState().openPieceSelector({ id: 'step_1-out-0', operation });

    expect(store.getState().openedPieceSelectorStepNameOrAddButtonId).toBe(
      'step_1-out-0',
    );
    expect(store.getState().pieceSelectorOperation).toEqual(operation);
  });

  it('adds after the selected step from the toolbar or the N key', () => {
    const store = createTestBuilderStore({ trigger: linearTrigger() });
    store.getState().selectStepByName('step_1');

    store.getState().openAddStepPieceSelector();

    expect(store.getState().openedPieceSelectorStepNameOrAddButtonId).toBe(
      pieceSelectorStateUtils.TOOLBAR_OPENER_ID,
    );
    expect(store.getState().pieceSelectorOperation).toEqual({
      type: FlowOperationType.ADD_ACTION,
      actionLocation: {
        parentStep: 'step_1',
        stepLocationRelativeToParent: StepLocationRelativeToParent.AFTER,
      },
    });
  });

  it('adds after the last step of the main chain when nothing is selected', () => {
    const store = createTestBuilderStore({ trigger: linearTrigger() });
    store.getState().removeStepSelection();

    store.getState().openAddStepPieceSelector();

    expect(store.getState().pieceSelectorOperation).toEqual({
      type: FlowOperationType.ADD_ACTION,
      actionLocation: {
        parentStep: 'step_2',
        stepLocationRelativeToParent: StepLocationRelativeToParent.AFTER,
      },
    });
  });

  it('replaces an action and switches to trigger mode for the trigger', () => {
    const store = createTestBuilderStore({ trigger: linearTrigger() });

    store.getState().setOpenedPieceSelectorStepNameOrAddButtonId('step_2');
    expect(store.getState().pieceSelectorOperation).toEqual({
      type: FlowOperationType.UPDATE_ACTION,
      stepName: 'step_2',
    });

    store.getState().setOpenedPieceSelectorStepNameOrAddButtonId('trigger');
    expect(store.getState().pieceSelectorOperation).toEqual({
      type: FlowOperationType.UPDATE_TRIGGER,
    });
  });

  it('needs an operation for openers that are not steps', () => {
    const store = createTestBuilderStore({ trigger: linearTrigger() });

    store
      .getState()
      .setOpenedPieceSelectorStepNameOrAddButtonId('step_2-out-0');

    expect(store.getState().pieceSelectorOperation).toBeNull();
  });

  it('keeps the drag release point only for the opener it belongs to', () => {
    const store = createTestBuilderStore({ trigger: linearTrigger() });
    const operation = flowCanvasUtils.createAddOperationFromAddButtonData({
      parentStepName: 'step_2',
      stepLocationRelativeToParent: StepLocationRelativeToParent.AFTER,
    });
    store.getState().setPendingStepPosition({
      selectorId: 'step_2-out-0',
      position: { x: 905, y: 503 },
    });

    store.getState().openPieceSelector({ id: 'step_2-out-0', operation });
    expect(store.getState().pendingStepPosition?.position).toEqual({
      x: 912,
      y: 496,
    });

    store.getState().openPieceSelector({ id: 'step_1-out-0', operation });
    expect(store.getState().pendingStepPosition).toBeNull();
  });
});

describe('closing the piece panel', () => {
  it('deselects the empty trigger when it closes without a pick', () => {
    const store = createTestBuilderStore({ trigger: emptyTrigger() });
    store.getState().selectStepByName('trigger');
    store.getState().openPieceSelector({
      id: 'trigger',
      operation: { type: FlowOperationType.UPDATE_TRIGGER },
    });

    store.getState().closePieceSelector();

    expect(
      store.getState().openedPieceSelectorStepNameOrAddButtonId,
    ).toBeNull();
    expect(store.getState().pieceSelectorOperation).toBeNull();
    expect(store.getState().selectedStep).toBeNull();
  });

  it('keeps the selection when another opener closes', () => {
    const store = createTestBuilderStore({ trigger: linearTrigger() });
    store.getState().selectStepByName('step_1');
    store.getState().openAddStepPieceSelector();

    store.getState().closePieceSelector();

    expect(
      store.getState().openedPieceSelectorStepNameOrAddButtonId,
    ).toBeNull();
    expect(store.getState().selectedStep).toBe('step_1');
  });

  it('closes when the step modal opens', () => {
    const store = createTestBuilderStore({ trigger: linearTrigger() });
    store.getState().openAddStepPieceSelector();

    store.getState().openStepModal({ stepName: 'step_1' });

    expect(
      store.getState().openedPieceSelectorStepNameOrAddButtonId,
    ).toBeNull();
  });
});

describe('picking from the piece panel', () => {
  beforeEach(() => {
    update.mockResolvedValue({ version: SERVER_VERSION });
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('adds the step at the opener location, closes the panel and opens the new step', async () => {
    const store = createTestBuilderStore({ trigger: linearTrigger() });
    const operation = flowCanvasUtils.createAddOperationFromAddButtonData({
      parentStepName: 'step_1',
      stepLocationRelativeToParent: StepLocationRelativeToParent.AFTER,
    });
    store.getState().openPieceSelector({ id: 'step_1-out-0', operation });
    const [codeItem] = stepUtils.coreActionsMetadata();

    const newStepName = store.getState().handleAddingOrUpdatingStep({
      pieceSelectorItem: codeItem,
      operation,
      selectStepAfter: true,
    });
    await settle();

    expect(sentOperations(update)[0]).toMatchObject({
      type: FlowOperationType.ADD_ACTION,
      request: {
        parentStep: 'step_1',
        stepLocationRelativeToParent: StepLocationRelativeToParent.AFTER,
        action: { name: newStepName },
      },
    });
    expect(
      store.getState().openedPieceSelectorStepNameOrAddButtonId,
    ).toBeNull();
    expect(store.getState().selectedStep).toBe(newStepName);
    expect(store.getState().isStepModalOpen).toBe(true);
  });
});

function linearTrigger() {
  return pieceTrigger(code({ name: 'step_1', next: code({ name: 'step_2' }) }));
}

function emptyTrigger(): FlowTrigger {
  return {
    name: 'trigger',
    valid: false,
    displayName: 'Select Trigger',
    type: FlowTriggerType.EMPTY,
    settings: {},
    lastUpdatedDate: '2026-01-01T00:00:00.000Z',
  };
}
