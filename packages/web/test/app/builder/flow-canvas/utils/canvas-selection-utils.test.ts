// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import {
  canvasSelectionUtils,
  CanvasSelectionStore,
} from '@/app/builder/flow-canvas/utils/canvas-selection-utils';

import { code, pieceTrigger, router } from '../../state/builder-store-fixtures';

describe('canvasSelectionUtils.selectStepOnCanvas', () => {
  it('makes the clicked step the only canvas selection', () => {
    const canvas = createFakeCanvas({ selectable: ['step_1', 'step_2'] });
    canvas.addSelectedNodes(['step_2']);

    canvasSelectionUtils.selectStepOnCanvas({ stepName: 'step_1', canvas });

    expect(canvasSelectionUtils.getCanvasSelection(canvas.nodeLookup)).toEqual([
      'step_1',
    ]);
  });

  it('clears the canvas selection for a step the canvas cannot select', () => {
    const canvas = createFakeCanvas({ selectable: ['step_1'] });
    canvas.addSelectedNodes(['step_1']);

    canvasSelectionUtils.selectStepOnCanvas({ stepName: 'trigger', canvas });

    expect(canvasSelectionUtils.getCanvasSelection(canvas.nodeLookup)).toEqual(
      [],
    );
    expect(canvas.forcedIds).toEqual([]);
  });
});

describe('canvasSelectionUtils.resolveSelectedNodes', () => {
  it('falls back to the selected step when the canvas selects nothing', () => {
    expect(
      canvasSelectionUtils.resolveSelectedNodes({
        canvasSelection: [],
        selectedStep: 'step_1',
      }),
    ).toEqual(['step_1']);
  });

  it('keeps the canvas selection when there is one', () => {
    expect(
      canvasSelectionUtils.resolveSelectedNodes({
        canvasSelection: ['step_1', 'step_2'],
        selectedStep: 'step_3',
      }),
    ).toEqual(['step_1', 'step_2']);
  });
});

describe('canvasSelectionUtils.expandSelectionWithChildren', () => {
  const trigger = pieceTrigger(
    router({
      name: 'step_1',
      branches: [
        code({ name: 'step_2', next: code({ name: 'step_3' }) }),
        null,
      ],
      next: code({ name: 'step_4' }),
    }),
  );

  it('adds the children of a selected router once', () => {
    expect(
      canvasSelectionUtils.expandSelectionWithChildren({
        stepNames: ['step_1', 'step_2'],
        trigger,
      }),
    ).toEqual(['step_1', 'step_2', 'step_3']);
  });

  it('leaves plain steps unchanged', () => {
    expect(
      canvasSelectionUtils.expandSelectionWithChildren({
        stepNames: ['step_4'],
        trigger,
      }),
    ).toEqual(['step_4']);
  });
});

describe('selection after a right-click', () => {
  it('leaves one coherent selection after a pane click and a step click', () => {
    const canvas = createFakeCanvas({ selectable: ['step_1', 'step_2'] });

    canvasSelectionUtils.selectStepOnCanvas({ stepName: 'step_2', canvas });
    canvas.unselectNodesAndEdges();
    const afterPaneClick = canvasSelectionUtils.resolveSelectedNodes({
      canvasSelection: canvasSelectionUtils.getCanvasSelection(
        canvas.nodeLookup,
      ),
      selectedStep: 'step_2',
    });
    canvasSelectionUtils.selectStepOnCanvas({ stepName: 'step_1', canvas });
    const afterStepClick = canvasSelectionUtils.resolveSelectedNodes({
      canvasSelection: canvasSelectionUtils.getCanvasSelection(
        canvas.nodeLookup,
      ),
      selectedStep: 'step_1',
    });

    expect(afterPaneClick).toEqual(['step_2']);
    expect(afterStepClick).toEqual(['step_1']);
  });

  it('never keeps a right-clicked trigger in the canvas selection', () => {
    const canvas = createFakeCanvas({ selectable: ['step_1'] });

    canvasSelectionUtils.selectStepOnCanvas({ stepName: 'trigger', canvas });
    canvasSelectionUtils.selectStepOnCanvas({ stepName: 'step_1', canvas });

    expect(canvasSelectionUtils.getCanvasSelection(canvas.nodeLookup)).toEqual([
      'step_1',
    ]);
  });
});

function createFakeCanvas({
  selectable,
}: {
  selectable: string[];
}): CanvasSelectionStore & { forcedIds: string[] } {
  const nodeLookup = new Map<
    string,
    { selected?: boolean; selectable?: boolean }
  >([
    ['trigger', { selectable: false }],
    ...selectable.map((id): [string, { selectable: boolean }] => [
      id,
      { selectable: true },
    ]),
  ]);
  const forcedIds: string[] = [];
  return {
    nodeLookup,
    forcedIds,
    addSelectedNodes: (nodeIds) => {
      nodeIds
        .filter((id) => nodeLookup.get(id)?.selectable === false)
        .forEach((id) => forcedIds.push(id));
      nodeLookup.forEach((node, id) => {
        nodeLookup.set(id, { ...node, selected: nodeIds.includes(id) });
      });
    },
    unselectNodesAndEdges: () => {
      nodeLookup.forEach((node, id) => {
        nodeLookup.set(id, { ...node, selected: false });
      });
    },
  };
}
