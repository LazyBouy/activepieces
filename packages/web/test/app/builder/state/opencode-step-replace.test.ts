// @vitest-environment jsdom
import {
  FlowAction,
  FlowActionType,
  FlowOperationType,
  flowStructureUtil,
  OpencodeStepSettings,
  opencodeStepUtil,
  PackageType,
  PieceAction,
  PieceType,
} from '@activepieces/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PieceSelectorItem } from '@/features/pieces';

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

describe('replacing an AI step keeps its OpenCode settings', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('carries settings.opencode to another routed AI action', async () => {
    const step = await replaceStep({
      current: aiPiece({ actionName: 'askAi', opencode: OPENCODE }),
      replacement: aiActionItem({ actionName: 'summarizeText' }),
    });

    expect(step.type).toBe(FlowActionType.PIECE);
    expect(opencodeStepUtil.settingsOf({ step })).toEqual(OPENCODE);
    expect(lastUpdateRequestSettings()).toMatchObject({
      actionName: 'summarizeText',
      opencode: OPENCODE,
    });
  });

  it('carries settings.opencode to an AI router', async () => {
    const step = await replaceStep({
      current: aiPiece({ actionName: 'classifyText', opencode: OPENCODE }),
      replacement: AI_ROUTER_ITEM,
    });

    expect(step.type).toBe(FlowActionType.AI_ROUTER);
    expect(opencodeStepUtil.settingsOf({ step })).toEqual(OPENCODE);
  });

  it('drops settings.opencode when the new step does not run on OpenCode', async () => {
    const step = await replaceStep({
      current: aiPiece({ actionName: 'askAi', opencode: OPENCODE }),
      replacement: aiActionItem({ actionName: 'generateImage' }),
    });

    expect(opencodeStepUtil.settingsOf({ step })).toBeUndefined();
    expect(lastUpdateRequestSettings()).not.toHaveProperty('opencode');
  });

  it('starts an AI step without OpenCode settings when it replaces another kind of step', async () => {
    const step = await replaceStep({
      current: code({ name: 'step_1' }),
      replacement: aiActionItem({ actionName: 'askAi' }),
    });

    expect(opencodeStepUtil.isOpencodeStep({ step })).toBe(true);
    expect(opencodeStepUtil.settingsOf({ step })).toBeUndefined();
  });
});

async function replaceStep({
  current,
  replacement,
}: {
  current: FlowAction;
  replacement: PieceSelectorItem;
}): Promise<FlowAction> {
  update.mockResolvedValue({ version: SERVER_VERSION });
  vi.useFakeTimers();
  const store = createTestBuilderStore({ trigger: pieceTrigger(current) });

  store.getState().handleAddingOrUpdatingStep({
    pieceSelectorItem: replacement,
    operation: { type: FlowOperationType.UPDATE_ACTION, stepName: 'step_1' },
    selectStepAfter: false,
  });
  await vi.advanceTimersByTimeAsync(STEP_UPDATE_DEBOUNCE_MS);
  vi.useRealTimers();
  await settle();

  return flowStructureUtil.getActionOrThrow(
    'step_1',
    store.getState().flowVersion.trigger,
  );
}

function lastUpdateRequestSettings(): Record<string, unknown> | undefined {
  const updates = sentOperations(update).filter(
    (operation) => operation.type === FlowOperationType.UPDATE_ACTION,
  );
  const last = updates[updates.length - 1];
  return last?.type === FlowOperationType.UPDATE_ACTION
    ? { ...last.request.settings }
    : undefined;
}

function aiPiece({
  actionName,
  opencode,
}: {
  actionName: string;
  opencode?: OpencodeStepSettings;
}): PieceAction {
  return {
    name: 'step_1',
    valid: true,
    displayName: actionName,
    lastUpdatedDate: '2026-01-01T00:00:00.000Z',
    type: FlowActionType.PIECE,
    settings: {
      pieceName: AI_PIECE_NAME,
      pieceVersion: '0.4.0',
      actionName,
      input: {},
      propertySettings: {},
      ...(opencode ? { opencode } : {}),
    },
  };
}

function aiActionItem({
  actionName,
}: {
  actionName: string;
}): PieceSelectorItem {
  return {
    type: FlowActionType.PIECE,
    actionOrTrigger: {
      name: actionName,
      displayName: actionName,
      description: '',
      props: {},
      requireAuth: false,
    },
    pieceMetadata: {
      type: FlowActionType.PIECE,
      displayName: 'AI',
      logoUrl: '',
      description: '',
      pieceName: AI_PIECE_NAME,
      pieceVersion: '0.4.0',
      categories: [],
      packageType: PackageType.REGISTRY,
      pieceType: PieceType.OFFICIAL,
      auth: undefined,
    },
  };
}

const AI_PIECE_NAME = '@activepieces/piece-ai';

const STEP_UPDATE_DEBOUNCE_MS = 1100;

const OPENCODE: OpencodeStepSettings = {
  sessionMode: 'ONE_PER_RUN',
  namespace: 'team',
  project: 'w0001',
  agent: 'reviewer',
};

const AI_ROUTER_ITEM: PieceSelectorItem = {
  type: FlowActionType.AI_ROUTER,
  displayName: 'AI Router',
  logoUrl: '',
  description: '',
};
