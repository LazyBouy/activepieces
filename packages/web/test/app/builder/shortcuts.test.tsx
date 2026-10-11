/**
 * @vitest-environment jsdom
 */
/* eslint-disable testing-library/no-unnecessary-act */
import {
  FlowOperationStatus,
  FlowOperationType,
  FlowStatus,
  FlowTriggerType,
  FlowVersionState,
  PopulatedFlow,
} from '@activepieces/shared';
import { QueryClient } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { io } from 'socket.io-client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  BuilderStateContext,
  BuilderStore,
  createBuilderStore,
} from '@/app/builder/builder-hooks';
import {
  canvasShortcutUtils,
  TIDY_UP_SHORTCUT,
  useHandleKeyPressOnCanvas,
} from '@/app/builder/shortcuts';
import { NoteDragOverlayMode } from '@/app/builder/state/notes-state';

const reactFlow = vi.hoisted(() => ({
  fitView: vi.fn(),
  zoomIn: vi.fn(),
  zoomOut: vi.fn(),
  zoomTo: vi.fn(),
}));

vi.mock('@xyflow/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@xyflow/react')>()),
  useReactFlow: () => reactFlow,
}));

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

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
      trigger: {
        name: 'trigger',
        valid: true,
        displayName: 'Trigger',
        type: FlowTriggerType.EMPTY,
        settings: {},
        lastUpdatedDate: now,
        nextAction: {
          name: 'step_1',
          valid: true,
          displayName: 'Step 1',
          type: 'CODE',
          settings: {},
          skip: false,
        },
      },
    },
  };
}

function createStore(): BuilderStore {
  const flow = buildFlow();
  return createBuilderStore({
    flow,
    flowVersion: flow.version,
    readonly: false,
    hideTestWidget: false,
    run: null,
    outputSampleData: {},
    inputSampleData: {},
    socket: io('http://localhost', { autoConnect: false }),
    queryClient: new QueryClient(),
  });
}

function Probe() {
  useHandleKeyPressOnCanvas();
  return null;
}

function dispatchKeyFrom(target: HTMLElement, init: KeyboardEventInit): void {
  act(() => {
    target.dispatchEvent(
      new KeyboardEvent('keydown', { bubbles: true, ...init }),
    );
  });
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;

async function setup({ readonly = false }: { readonly?: boolean } = {}) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  const store = createStore();
  const applyOperation = vi.fn();
  store.setState({ applyOperation, readonly });
  store.getState().selectStepByName('step_1');
  const mountedRoot = root;
  await act(async () => {
    mountedRoot.render(
      <BuilderStateContext.Provider value={store}>
        <Probe />
      </BuilderStateContext.Provider>,
    );
  });
  return { container, applyOperation, store };
}

describe('canvas shortcuts while editing step inputs (GIT-1445)', () => {
  afterEach(async () => {
    const mountedRoot = root;
    if (mountedRoot) {
      await act(async () => {
        mountedRoot.unmount();
      });
    }
    container?.remove();
    root = null;
    container = null;
  });

  it.each(['input', 'textarea', 'select'] as const)(
    'ignores Ctrl+E when focus is in a %s',
    async (tagName) => {
      const { container, applyOperation } = await setup();
      const field = document.createElement(tagName);
      container.appendChild(field);
      dispatchKeyFrom(field, { key: 'e', ctrlKey: true });
      expect(applyOperation).not.toHaveBeenCalled();
    },
  );

  it('ignores Ctrl+E when focus is in a contenteditable element', async () => {
    const { container, applyOperation } = await setup();
    const editor = document.createElement('div');
    Object.defineProperty(editor, 'isContentEditable', { value: true });
    container.appendChild(editor);
    dispatchKeyFrom(editor, { key: 'e', ctrlKey: true });
    expect(applyOperation).not.toHaveBeenCalled();
  });

  it('ignores Shift+Delete when focus is in an input', async () => {
    const { container, applyOperation } = await setup();
    const field = document.createElement('input');
    container.appendChild(field);
    dispatchKeyFrom(field, { key: 'Delete', shiftKey: true });
    expect(applyOperation).not.toHaveBeenCalled();
  });

  it('still toggles skip with Ctrl+E when focus is on the canvas', async () => {
    const { applyOperation } = await setup();
    dispatchKeyFrom(document.body, { key: 'e', ctrlKey: true });
    expect(applyOperation).toHaveBeenCalledTimes(1);
    expect(applyOperation).toHaveBeenCalledWith({
      type: FlowOperationType.SET_SKIP_ACTION,
      request: { names: ['step_1'], skip: true },
    });
  });

  it('still deletes the selected step with Shift+Delete on the canvas', async () => {
    const { applyOperation } = await setup();
    dispatchKeyFrom(document.body, { key: 'Delete', shiftKey: true });
    expect(applyOperation).toHaveBeenCalledWith({
      type: FlowOperationType.DELETE_ACTION,
      request: { names: ['step_1'] },
    });
  });
});

describe('canvas keyboard map', () => {
  afterEach(async () => {
    const mountedRoot = root;
    if (mountedRoot) {
      await act(async () => {
        mountedRoot.unmount();
      });
    }
    container?.remove();
    root = null;
    container = null;
    vi.clearAllMocks();
  });

  it('opens the step modal for the selected step with Enter', async () => {
    const { store } = await setup();
    expect(store.getState().isStepModalOpen).toBe(false);
    dispatchKeyFrom(document.body, { key: 'Enter' });
    expect(store.getState().isStepModalOpen).toBe(true);
    expect(store.getState().selectedStep).toBe('step_1');
    expect(store.getState().stepModalEditNameOnOpen).toBe(false);
  });

  it('opens the step modal with the name in edit mode on F2', async () => {
    const { store } = await setup();
    dispatchKeyFrom(document.body, { key: 'F2' });
    expect(store.getState().isStepModalOpen).toBe(true);
    expect(store.getState().stepModalEditNameOnOpen).toBe(true);
  });

  it('does not open the step modal from Enter on a button', async () => {
    const { container, store } = await setup();
    const button = document.createElement('button');
    container.appendChild(button);
    dispatchKeyFrom(button, { key: 'Enter' });
    expect(store.getState().isStepModalOpen).toBe(false);
  });

  it('turns canvas shortcuts off while the step modal is open', async () => {
    const { applyOperation, store } = await setup();
    await act(async () => {
      store.getState().openStepModal({ stepName: 'step_1' });
    });
    dispatchKeyFrom(document.body, { key: 'd' });
    dispatchKeyFrom(document.body, { key: 'Delete' });
    expect(applyOperation).not.toHaveBeenCalled();
  });

  it('skips the selected steps with D', async () => {
    const { applyOperation } = await setup();
    dispatchKeyFrom(document.body, { key: 'd' });
    expect(applyOperation).toHaveBeenCalledWith({
      type: FlowOperationType.SET_SKIP_ACTION,
      request: { names: ['step_1'], skip: true },
    });
  });

  it('ignores D while a modifier is held', async () => {
    const { applyOperation } = await setup();
    dispatchKeyFrom(document.body, { key: 'd', ctrlKey: true });
    dispatchKeyFrom(document.body, { key: 'd', altKey: true });
    expect(applyOperation).not.toHaveBeenCalled();
  });

  it.each(['Delete', 'Backspace'])(
    'deletes the selected steps with %s',
    async (key) => {
      const { applyOperation } = await setup();
      dispatchKeyFrom(document.body, { key });
      expect(applyOperation).toHaveBeenCalledWith({
        type: FlowOperationType.DELETE_ACTION,
        request: { names: ['step_1'] },
      });
    },
  );

  it('never sends the trigger to the delete operation', async () => {
    const { applyOperation, store } = await setup();
    await act(async () => {
      store.getState().setSelectedNodes(['trigger']);
    });
    dispatchKeyFrom(document.body, { key: 'Backspace' });
    expect(applyOperation).not.toHaveBeenCalled();
  });

  it('leaves selected notes out of step operations', async () => {
    const { applyOperation, store } = await setup();
    await act(async () => {
      store.getState().setSelectedNodes(['note-1', 'step_1']);
    });
    dispatchKeyFrom(document.body, { key: 'Delete' });
    expect(applyOperation).toHaveBeenCalledWith({
      type: FlowOperationType.DELETE_ACTION,
      request: { names: ['step_1'] },
    });
  });

  it('ignores single keys when focus is outside the canvas', async () => {
    const { container, applyOperation } = await setup();
    const button = document.createElement('button');
    container.appendChild(button);
    dispatchKeyFrom(button, { key: 'd' });
    dispatchKeyFrom(button, { key: 'Backspace' });
    dispatchKeyFrom(button, { key: '1' });
    expect(applyOperation).not.toHaveBeenCalled();
    expect(reactFlow.fitView).not.toHaveBeenCalled();
  });

  it('handles single keys when focus is inside the canvas', async () => {
    const { container, applyOperation } = await setup();
    const canvas = document.createElement('div');
    canvas.className = 'react-flow';
    const step = document.createElement('div');
    canvas.appendChild(step);
    container.appendChild(canvas);
    dispatchKeyFrom(step, { key: 'd' });
    expect(applyOperation).toHaveBeenCalledTimes(1);
  });

  it('fits the view with 1 and resets the zoom with 0', async () => {
    await setup();
    dispatchKeyFrom(document.body, { key: '1' });
    expect(reactFlow.fitView).toHaveBeenCalledWith({
      padding: 0.2,
      maxZoom: 1,
      duration: 0,
    });
    dispatchKeyFrom(document.body, { key: '0' });
    expect(reactFlow.zoomTo).toHaveBeenCalledWith(1, { duration: 0 });
  });

  it.each([
    { key: '+', shiftKey: true },
    { key: '+', shiftKey: false },
    { key: '=', shiftKey: false },
  ])('zooms in with $key', async ({ key, shiftKey }) => {
    await setup();
    dispatchKeyFrom(document.body, { key, shiftKey });
    expect(reactFlow.zoomIn).toHaveBeenCalledWith({ duration: 0 });
  });

  it('zooms out with -', async () => {
    await setup();
    dispatchKeyFrom(document.body, { key: '-' });
    expect(reactFlow.zoomOut).toHaveBeenCalledWith({ duration: 0 });
  });

  it('starts placing a new note with Shift+S', async () => {
    const { store } = await setup();
    dispatchKeyFrom(document.body, { key: 'S', shiftKey: true });
    expect(store.getState().noteDragOverlayMode).toBe(
      NoteDragOverlayMode.CREATE,
    );
    expect(store.getState().draggedNote?.size).toEqual({
      width: 240,
      height: 160,
    });
  });

  it('arranges the steps with Shift+Alt+T on the physical T key', async () => {
    const { store } = await setup();
    const tidyUp = vi.fn();
    await act(async () => {
      store.setState({ tidyUp });
    });
    dispatchKeyFrom(document.body, {
      key: '†',
      code: 'KeyT',
      shiftKey: true,
      altKey: true,
    });
    expect(tidyUp).toHaveBeenCalledTimes(1);
  });

  it('does not arrange the steps on a read-only canvas or without Alt', async () => {
    const { store } = await setup({ readonly: true });
    const tidyUp = vi.fn();
    await act(async () => {
      store.setState({ tidyUp });
    });
    dispatchKeyFrom(document.body, {
      key: 'T',
      code: 'KeyT',
      shiftKey: true,
      altKey: true,
    });
    await act(async () => {
      store.setState({ readonly: false });
    });
    dispatchKeyFrom(document.body, { key: 'T', code: 'KeyT', shiftKey: true });
    expect(tidyUp).not.toHaveBeenCalled();
  });

  it('keeps editing keys off on a read-only canvas but still zooms', async () => {
    const { store, applyOperation } = await setup({ readonly: true });
    dispatchKeyFrom(document.body, { key: 'S', shiftKey: true });
    dispatchKeyFrom(document.body, { key: 'd' });
    dispatchKeyFrom(document.body, { key: 'Delete' });
    expect(store.getState().noteDragOverlayMode).toBeNull();
    expect(applyOperation).not.toHaveBeenCalled();
    dispatchKeyFrom(document.body, { key: '-' });
    expect(reactFlow.zoomOut).toHaveBeenCalled();
  });
});

describe('canvasShortcutUtils.matchesShortcut', () => {
  const noModifiers = {
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
  };

  it('matches tidy-up on the physical T key even when Option changes the character', () => {
    expect(
      canvasShortcutUtils.matchesShortcut({
        event: {
          ...noModifiers,
          key: '†',
          code: 'KeyT',
          shiftKey: true,
          altKey: true,
        },
        shortcut: TIDY_UP_SHORTCUT,
      }),
    ).toBe(true);
  });

  it('requires every listed modifier', () => {
    expect(
      canvasShortcutUtils.matchesShortcut({
        event: { ...noModifiers, key: 'T', code: 'KeyT', shiftKey: true },
        shortcut: TIDY_UP_SHORTCUT,
      }),
    ).toBe(false);
  });

  it('accepts the meta key wherever control is listed', () => {
    expect(
      canvasShortcutUtils.matchesShortcut({
        event: { ...noModifiers, key: 'c', code: 'KeyC', metaKey: true },
        shortcut: { shortcutKey: 'c', withCtrl: true },
      }),
    ).toBe(true);
  });

  it('no longer binds a minimap toggle', () => {
    expect(
      canvasShortcutUtils.findShortcutMatch({
        ...noModifiers,
        key: 'm',
        code: 'KeyM',
        ctrlKey: true,
      }),
    ).toBeNull();
  });
});
