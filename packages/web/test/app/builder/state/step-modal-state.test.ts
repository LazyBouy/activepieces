// @vitest-environment jsdom
import { FlowTriggerType } from '@activepieces/shared';
import { describe, expect, it } from 'vitest';

import { RightSideBarType } from '@/app/builder/types';

import {
  code,
  createTestBuilderStore,
  pieceTrigger,
  router,
} from './builder-store-fixtures';

describe('step modal open and close rules', () => {
  it('selects a step without opening the modal', () => {
    const store = createTestBuilderStore({
      trigger: pieceTrigger(code({ name: 'step_1' })),
    });
    store.getState().selectStepByName('step_1');
    expect(store.getState().selectedStep).toBe('step_1');
    expect(store.getState().isStepModalOpen).toBe(false);
    expect(store.getState().rightSidebar).toBe(RightSideBarType.NONE);
  });

  it('opens the modal for a step and keeps the selection after closing', () => {
    const store = createTestBuilderStore({
      trigger: pieceTrigger(code({ name: 'step_1' })),
    });
    store.getState().openStepModal({ stepName: 'step_1' });
    expect(store.getState().isStepModalOpen).toBe(true);
    expect(store.getState().selectedStep).toBe('step_1');
    expect(store.getState().selectedNodes).toEqual(['step_1']);
    store.getState().closeStepModal();
    expect(store.getState().isStepModalOpen).toBe(false);
    expect(store.getState().selectedStep).toBe('step_1');
  });

  it('swaps the modal content in place when another step is selected', () => {
    const store = createTestBuilderStore({
      trigger: pieceTrigger(
        code({ name: 'step_1', next: code({ name: 'step_2' }) }),
      ),
    });
    store.getState().openStepModal({ stepName: 'step_1' });
    store.getState().selectStepByName('step_2');
    expect(store.getState().isStepModalOpen).toBe(true);
    expect(store.getState().selectedStep).toBe('step_2');
  });

  it('opens a router with the requested branch selected', () => {
    const store = createTestBuilderStore({
      trigger: pieceTrigger(
        router({ name: 'step_1', branches: [code({ name: 'step_2' }), null] }),
      ),
    });
    store.getState().openStepModal({ stepName: 'step_1', branchIndex: 1 });
    expect(store.getState().selectedBranchIndex).toBe(1);
    expect(store.getState().isStepModalOpen).toBe(true);
  });

  it('queues a test request when the modal opens to test', () => {
    const store = createTestBuilderStore({
      trigger: pieceTrigger(code({ name: 'step_1' })),
    });
    store.getState().openStepModal({ stepName: 'step_1', runTest: true });
    expect(store.getState().stepTestRequest).toBe('step_1');
    store.getState().closeStepModal();
    expect(store.getState().stepTestRequest).toBeNull();
  });

  it('remembers that the name should start in edit mode', () => {
    const store = createTestBuilderStore({
      trigger: pieceTrigger(code({ name: 'step_1' })),
    });
    store.getState().openStepModal({ stepName: 'step_1', editName: true });
    expect(store.getState().stepModalEditNameOnOpen).toBe(true);
    store.getState().selectStepByName('trigger');
    expect(store.getState().stepModalEditNameOnOpen).toBe(false);
  });

  it('never opens the modal for an empty trigger', () => {
    const store = createTestBuilderStore({
      trigger: {
        ...pieceTrigger(),
        type: FlowTriggerType.EMPTY,
        settings: {},
      },
    });
    store.getState().openStepModal({ stepName: 'trigger' });
    expect(store.getState().isStepModalOpen).toBe(false);
  });

  it('closes the modal when the open step is deleted', () => {
    const store = createTestBuilderStore({
      trigger: pieceTrigger(code({ name: 'step_1' })),
    });
    store.getState().openStepModal({ stepName: 'step_1' });
    store.getState().exitStepSettings();
    expect(store.getState().isStepModalOpen).toBe(false);
    expect(store.getState().selectedStep).toBeNull();
  });
});
