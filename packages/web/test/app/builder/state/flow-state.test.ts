// @vitest-environment jsdom
import { FlowOperationRequest, FlowOperationType } from '@activepieces/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

describe('flow state: step position operations', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('queues two quick position operations for the same step instead of debouncing them', async () => {
    update.mockResolvedValue({ version: SERVER_VERSION });
    const store = createTestBuilderStore({
      trigger: pieceTrigger(code({ name: 'step_1' })),
    });
    const first: FlowOperationRequest = {
      type: FlowOperationType.UPDATE_STEP_POSITIONS,
      request: { positions: { step_1: { x: 400, y: 240 } } },
    };
    const second: FlowOperationRequest = {
      type: FlowOperationType.UPDATE_STEP_POSITIONS,
      request: { positions: { step_1: { x: 640, y: 400 } } },
    };

    store.getState().applyOperation(first);
    store.getState().applyOperation(second);
    await settle();

    expect(sentOperations(update)).toEqual([first, second]);
    expect(store.getState().flowVersion.stepPositions).toEqual({
      step_1: { x: 640, y: 400 },
    });
  });

  it('keeps the optimistic local positions when the server answers', async () => {
    update.mockResolvedValue({
      version: { ...SERVER_VERSION, id: 'version-2' },
    });
    const store = createTestBuilderStore({
      trigger: pieceTrigger(code({ name: 'step_1' })),
    });

    store.getState().applyOperation({
      type: FlowOperationType.UPDATE_STEP_POSITIONS,
      request: { positions: { step_1: { x: 640, y: 400 } } },
    });
    await settle();

    expect(store.getState().flowVersion.id).toBe('version-2');
    expect(store.getState().flowVersion.stepPositions).toEqual({
      step_1: { x: 640, y: 400 },
    });
  });
});
