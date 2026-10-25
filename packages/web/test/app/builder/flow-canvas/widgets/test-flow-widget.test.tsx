/**
 * @vitest-environment jsdom
 */
/* eslint-disable testing-library/no-unnecessary-act */
import {
  FlowOperationStatus,
  FlowRun,
  FlowRunStatus,
  FlowStatus,
  FlowTriggerType,
  FlowVersionState,
  PopulatedFlow,
  RunEnvironment,
} from '@activepieces/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { io } from 'socket.io-client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  BuilderStateContext,
  createBuilderStore,
} from '@/app/builder/builder-hooks';
import { TestFlowWidget } from '@/app/builder/flow-canvas/widgets/test-flow-widget';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  runFlow: vi.fn(),
  bulkCancel: vi.fn(),
  getPopulated: vi.fn(),
}));

vi.mock('i18next', () => ({ t: (key: string) => key }));

vi.mock('@/features/flows', () => ({
  flowHooks: {
    useTestFlowOrStartManualTrigger: () => ({
      mutate: mocks.runFlow,
      isPending: false,
    }),
  },
}));

vi.mock('@/features/flow-runs', () => ({
  flowRunsApi: {
    bulkCancel: mocks.bulkCancel,
    getPopulated: mocks.getPopulated,
  },
  flowRunUtils: {
    findLastStepWithStatus: () => null,
    pinLoopsToIterationsWithFailedStep: () => ({}),
    updateRunSteps: () => ({}),
  },
}));

vi.mock('@/features/pieces', () => ({
  pieceSelectorUtils: {
    isChatTrigger: () => false,
    isManualTrigger: () => false,
  },
}));

vi.mock('@/hooks/authorization-hooks', () => ({
  useAuthorization: () => ({ checkAccess: () => true }),
}));

vi.mock(
  '@/app/builder/builder-header/flow-status/view-draft-or-edit-flow-button',
  () => ({
    EditFlowOrViewDraftButton: () => <button type="button">Edit flow</button>,
  }),
);

let container: HTMLDivElement | null = null;
let root: Root | null = null;

describe('TestFlowWidget in the test bar', () => {
  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
    vi.clearAllMocks();
  });

  it('renders exactly one button named Test Flow and starts a run on click', () => {
    renderWidget({ run: null });
    const buttons = buttonsNamed('Test Flow');
    expect(buttons).toHaveLength(1);
    expect(textOf(buttons[0])).toBe('Test Flow');
    act(() => buttons[0].click());
    expect(mocks.runFlow).toHaveBeenCalledTimes(1);
  });

  it('shows a spinner and a stop button while a queued test run waits', () => {
    renderWidget({ run: createRun(FlowRunStatus.QUEUED) });
    const running = buttonsNamed('Test Flow');
    expect(running).toHaveLength(1);
    expect(running[0].matches('[aria-busy="true"]')).toBe(true);
    expect(textOf(running[0])).toBe('');
    expect(buttonsNamed('Stop')).toHaveLength(1);
  });

  it('cancels the run through the run-cancel request', async () => {
    mocks.bulkCancel.mockResolvedValue([]);
    mocks.getPopulated.mockResolvedValue(createRun(FlowRunStatus.CANCELED));
    renderWidget({ run: createRun(FlowRunStatus.PAUSED) });
    await act(async () => {
      buttonsNamed('Stop')[0].click();
    });
    expect(mocks.bulkCancel).toHaveBeenCalledWith({
      projectId: 'project-1',
      flowRunIds: ['run-1'],
    });
  });

  it('cannot stop a run that is already running', () => {
    renderWidget({ run: createRun(FlowRunStatus.RUNNING) });
    expect(buttonsNamed('Test Flow')[0].matches('[aria-busy="true"]')).toBe(
      true,
    );
    expect(buttonsNamed('Stop')).toHaveLength(0);
  });

  it('offers to edit the flow once the test run has finished', () => {
    renderWidget({ run: createRun(FlowRunStatus.SUCCEEDED) });
    expect(buttonsNamed('Test Flow')).toHaveLength(0);
    expect(buttonsNamed('Edit flow')).toHaveLength(1);
  });
});

function renderWidget({ run }: { run: FlowRun | null }): void {
  const flow = buildFlow();
  const store = createBuilderStore({
    flow,
    flowVersion: flow.version,
    readonly: false,
    hideTestWidget: false,
    run,
    outputSampleData: {},
    inputSampleData: {},
    socket: io('http://localhost', { autoConnect: false }),
    queryClient: new QueryClient(),
  });
  if (run) {
    store.setState({ readonly: true });
  }
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  const mountedRoot = root;
  act(() =>
    mountedRoot.render(
      <QueryClientProvider client={new QueryClient()}>
        <BuilderStateContext.Provider value={store}>
          <TestFlowWidget />
        </BuilderStateContext.Provider>
      </QueryClientProvider>,
    ),
  );
}

function textOf(element: Element): string {
  return element.textContent ?? '';
}

function buttonsNamed(name: string): HTMLButtonElement[] {
  return [...document.querySelectorAll('button')].filter(
    (button) =>
      (button.getAttribute('aria-label') ?? button.textContent ?? '').trim() ===
      name,
  );
}

function createRun(status: FlowRunStatus): FlowRun {
  const now = new Date().toISOString();
  return {
    id: 'run-1',
    created: now,
    updated: now,
    projectId: 'project-1',
    flowId: 'flow-1',
    flowVersionId: 'version-1',
    status,
    environment: RunEnvironment.TESTING,
    steps: {},
    tags: [],
    startTime: now,
    failParentOnFailure: false,
    logsFileId: null,
    archivedAt: null,
  };
}

function buildFlow(): PopulatedFlow {
  const now = new Date().toISOString();
  return {
    id: 'flow-1',
    created: now,
    updated: now,
    projectId: 'project-1',
    externalId: 'flow-1',
    ownerId: null,
    folderId: null,
    status: FlowStatus.DISABLED,
    publishedVersionId: null,
    metadata: null,
    operationStatus: FlowOperationStatus.NONE,
    timeSavedPerRun: null,
    templateId: null,
    createdBy: null,
    version: {
      id: 'version-1',
      created: now,
      updated: now,
      flowId: 'flow-1',
      displayName: 'Test flow',
      updatedBy: null,
      valid: true,
      schemaVersion: null,
      agentIds: [],
      state: FlowVersionState.DRAFT,
      connectionIds: [],
      backupFiles: null,
      notes: [],
      stepPositions: {},
      opencodeDefaults: {},
      trigger: {
        name: 'trigger',
        valid: true,
        displayName: 'Webhook',
        type: FlowTriggerType.PIECE,
        settings: {
          pieceName: '@activepieces/piece-webhook',
          pieceVersion: '0.1.42',
          triggerName: 'catch_webhook',
          input: {},
          propertySettings: {},
          sampleData: { lastTestDate: now },
        },
        lastUpdatedDate: now,
      },
    },
  };
}
