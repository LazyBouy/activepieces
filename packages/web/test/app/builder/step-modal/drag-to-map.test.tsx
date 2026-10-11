// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { BuilderStateContext } from '@/app/builder/builder-hooks';
import { TiptapEditor } from '@/app/builder/piece-properties/text-input-with-mentions/tiptap-editor';
import { dragToMapUtils } from '@/app/builder/step-modal/drag-to-map';
import { mappingDropEvent } from '@/app/builder/step-modal/mapping-drop-event';

import {
  code,
  createTestBuilderStore,
  pieceTrigger,
} from '../state/builder-store-fixtures';

vi.mock('@/features/pieces', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/features/pieces')>();
  return {
    ...original,
    stepsHooks: {
      ...original.stepsHooks,
      useStepsMetadata: () => [],
    },
  };
});

vi.mock('@/features/variables/hooks/variables-hooks', () => ({
  variablesQueries: {
    useVariables: () => ({ data: undefined }),
  },
}));

vi.mock('@/components/providers/embed-provider', () => ({
  useEmbedding: () => ({ embedState: { isEmbedded: false } }),
}));

beforeAll(() => {
  const emptyRect = {
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    width: 0,
    height: 0,
    x: 0,
    y: 0,
  };
  Object.defineProperty(Range.prototype, 'getClientRects', {
    value: () => [],
    configurable: true,
  });
  Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
    value: () => emptyRect,
    configurable: true,
  });
  Object.defineProperty(document, 'elementFromPoint', {
    value: () => null,
    configurable: true,
  });
});

describe('drag to map', () => {
  it('inserts the same mention token the data selector inserts', async () => {
    const store = createTestBuilderStore({
      trigger: pieceTrigger(code({ name: 'step_1' })),
    });
    const onChange = vi.fn();
    render(
      <BuilderStateContext.Provider value={store}>
        <TiptapEditor onChange={onChange} initialValue="Hello " />
      </BuilderStateContext.Provider>,
    );
    const editorElement = screen.getByRole('textbox');
    const target = dragToMapUtils.findDropTarget(editorElement);
    expect(target).not.toBeNull();
    if (!target) {
      return;
    }

    await act(async () => {
      dragToMapUtils.dispatchDrop({
        target,
        propertyPath: "trigger['output']['name']",
        clientX: 10,
        clientY: 10,
      });
    });

    expect(onChange).toHaveBeenLastCalledWith(
      "Hello {{trigger['output']['name']}}",
    );

    fireEvent.focus(editorElement);
    const insertMention = store.getState().insertMention;
    expect(insertMention).not.toBeNull();
    await act(async () => {
      insertMention?.("step_1['output'][0]");
    });
    expect(onChange).toHaveBeenLastCalledWith(
      "Hello {{trigger['output']['name']}}{{step_1['output'][0]}}",
    );
  });

  it('marks enabled mention inputs as droppable while a drag is active', async () => {
    const store = createTestBuilderStore({
      trigger: pieceTrigger(code({ name: 'step_1' })),
    });
    render(
      <BuilderStateContext.Provider value={store}>
        <TiptapEditor onChange={vi.fn()} ariaLabel="enabled" />
        <TiptapEditor onChange={vi.fn()} ariaLabel="disabled" disabled />
      </BuilderStateContext.Provider>,
    );
    const enabledTarget = dragToMapUtils.findDropTarget(
      screen.getByRole('textbox', { name: 'enabled' }),
    );
    const disabledTarget = dragToMapUtils.findDropTarget(
      screen.getByRole('textbox', { name: 'disabled' }),
    );
    expect(enabledTarget).not.toBeNull();
    expect(disabledTarget).toBeNull();
    expect(enabledTarget?.classList.contains('ap-mapping-droppable')).toBe(
      false,
    );

    await act(async () => {
      store.getState().setMappingDragSource({
        label: 'name',
        propertyPath: "trigger['output']['name']",
      });
    });
    expect(enabledTarget?.classList.contains('ap-mapping-droppable')).toBe(
      true,
    );

    await act(async () => {
      store.getState().setMappingDragSource(null);
    });
    expect(enabledTarget?.classList.contains('ap-mapping-droppable')).toBe(
      false,
    );
  });

  it('ignores drop events that carry no mapping detail', () => {
    expect(mappingDropEvent.read(new Event(mappingDropEvent.NAME))).toBeNull();
    expect(
      mappingDropEvent.read(
        new CustomEvent(mappingDropEvent.NAME, { detail: { path: 1 } }),
      ),
    ).toBeNull();
    expect(
      mappingDropEvent.read(
        mappingDropEvent.create({
          propertyPath: 'a',
          clientX: 1,
          clientY: 2,
        }),
      ),
    ).toEqual({ propertyPath: 'a', clientX: 1, clientY: 2 });
  });

  it('finds the drop target from any element inside a mention input', () => {
    render(
      <div data-mapping-drop="" data-testid="target">
        <span data-testid="inner">field</span>
      </div>,
    );
    expect(dragToMapUtils.findDropTarget(screen.getByTestId('inner'))).toBe(
      screen.getByTestId('target'),
    );
    expect(dragToMapUtils.findDropTarget(document.body)).toBeNull();
    expect(dragToMapUtils.findDropTarget(null)).toBeNull();
  });
});
