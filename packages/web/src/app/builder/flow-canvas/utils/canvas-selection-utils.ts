import { isNil } from '@activepieces/core-utils';
import {
  FlowActionType,
  flowStructureUtil,
  FlowTrigger,
} from '@activepieces/shared';

function getCanvasSelection(
  nodeLookup: CanvasSelectionStore['nodeLookup'],
): string[] {
  return [...nodeLookup.entries()]
    .filter(([, node]) => node.selected === true)
    .map(([id]) => id);
}

function resolveSelectedNodes({
  canvasSelection,
  selectedStep,
}: {
  canvasSelection: string[];
  selectedStep: string | null;
}): string[] {
  if (canvasSelection.length === 0 && !isNil(selectedStep)) {
    return [selectedStep];
  }
  return canvasSelection;
}

function selectStepOnCanvas({
  stepName,
  canvas,
}: {
  stepName: string;
  canvas: CanvasSelectionStore;
}): void {
  const node = canvas.nodeLookup.get(stepName);
  if (!isNil(node) && node.selectable !== false) {
    canvas.addSelectedNodes([stepName]);
    return;
  }
  canvas.unselectNodesAndEdges();
}

function expandSelectionWithChildren({
  stepNames,
  trigger,
}: {
  stepNames: string[];
  trigger: FlowTrigger;
}): string[] {
  const childNames = stepNames
    .map((stepName) => flowStructureUtil.getStep(stepName, trigger))
    .filter((step) => !isNil(step))
    .filter(
      (step) =>
        step.type === FlowActionType.LOOP_ON_ITEMS ||
        flowStructureUtil.isBranchedAction(step) ||
        flowStructureUtil.hasContinueOnFailureBranches(step),
    )
    .flatMap((step) =>
      flowStructureUtil.getAllChildSteps(step).map((child) => child.name),
    );
  return [...new Set([...stepNames, ...childNames])];
}

export const canvasSelectionUtils = {
  getCanvasSelection,
  resolveSelectedNodes,
  selectStepOnCanvas,
  expandSelectionWithChildren,
};

export type CanvasSelectionStore = {
  nodeLookup: ReadonlyMap<string, { selected?: boolean; selectable?: boolean }>;
  addSelectedNodes: (nodeIds: string[]) => void;
  unselectNodesAndEdges: () => void;
};
