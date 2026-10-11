import { isNil } from '@activepieces/core-utils';
import {
  flowStructureUtil,
  StepLocationRelativeToParent,
} from '@activepieces/shared';
import { useReactFlow } from '@xyflow/react';
import { useCallback, useEffect } from 'react';

import { isEditableTarget } from '@/lib/dom-utils';

import { useBuilderStateContext } from './builder-hooks';
import { useFitToView } from './flow-canvas/canvas-controls/use-fit-to-view';
import {
  CanvasShortcutAction,
  CanvasShortcutProps,
  CanvasShortcutsProps,
} from './flow-canvas/context-menu/canvas-context-menu';
import { canvasBulkActions } from './flow-canvas/utils/bulk-actions';
import { flowCanvasConsts } from './flow-canvas/utils/consts';
import { flowCanvasUtils } from './flow-canvas/utils/flow-canvas-utils';
import { NoteDragOverlayMode } from './state/notes-state';

export const useHandleKeyPressOnCanvas = () => {
  const [
    selectedNodes,
    flowVersion,
    selectedStep,
    exitStepSettings,
    applyOperation,
    readonly,
    setDraggedNote,
    tidyUp,
    isStepModalOpen,
    openStepModal,
    openAddStepPieceSelector,
    setOpenedPieceSelectorStepNameOrAddButtonId,
  ] = useBuilderStateContext((state) => [
    state.selectedNodes,
    state.flowVersion,
    state.selectedStep,
    state.exitStepSettings,
    state.applyOperation,
    state.readonly,
    state.setDraggedNote,
    state.tidyUp,
    state.isStepModalOpen,
    state.openStepModal,
    state.openAddStepPieceSelector,
    state.setOpenedPieceSelectorStepNameOrAddButtonId,
  ]);
  const { zoomIn, zoomOut, zoomTo } = useReactFlow();
  const fitToView = useFitToView();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (isStepModalOpen || isEditableTarget(e.target)) {
        return;
      }
      const match = findShortcutMatch(e);
      if (!match) {
        return;
      }
      if (match.shortcut.requiresCanvasFocus && !isCanvasTarget(e.target)) {
        return;
      }
      const insideSelectionRect =
        e.target instanceof HTMLElement &&
        e.target.classList.contains(
          flowCanvasConsts.NODE_SELECTION_RECT_CLASS_NAME,
        );
      const insideStep =
        e.target instanceof HTMLElement &&
        e.target.closest(
          `[data-${flowCanvasConsts.STEP_CONTEXT_MENU_ATTRIBUTE}]`,
        );
      const insideBody = e.target === document.body;
      const selectedNodesWithoutTrigger = selectedNodes.filter(
        (node) => node !== flowVersion.trigger.name,
      );
      const selectedActionNames = selectedNodesWithoutTrigger.filter(
        (node) => !isNil(flowStructureUtil.getStep(node, flowVersion.trigger)),
      );

      const handlers: Record<CanvasShortcutAction, () => void> = {
        Copy: () => {
          if (
            selectedNodesWithoutTrigger.length > 0 &&
            document.getSelection()?.toString() === ''
          ) {
            e.stopPropagation();
            e.preventDefault();

            canvasBulkActions.copySelectedNodes({
              selectedNodes: selectedNodesWithoutTrigger,
              flowVersion,
            });
          }
        },
        Delete: () => {
          if (readonly) {
            return;
          }
          if (selectedActionNames.length > 0) {
            e.stopPropagation();
            e.preventDefault();
            canvasBulkActions.deleteSelectedNodes({
              exitStepSettings,
              selectedStep,
              selectedNodes: selectedActionNames,
              applyOperation,
            });
          }
        },
        Skip: () => {
          if (readonly) {
            return;
          }
          if (selectedActionNames.length > 0) {
            e.preventDefault();
            canvasBulkActions.toggleSkipSelectedNodes({
              selectedNodes: selectedActionNames,
              flowVersion,
              applyOperation,
            });
          }
        },
        ExitDrag: () => {
          setDraggedNote(null, null);
        },
        Paste: () => {
          if (
            readonly ||
            (!insideSelectionRect && !insideStep && !insideBody)
          ) {
            return;
          }
          e.stopPropagation();
          e.preventDefault();
          canvasBulkActions.getActionsInClipboard().then((actions) => {
            if (actions.length > 0) {
              const lastStep = [
                flowVersion.trigger,
                ...flowStructureUtil.getAllNextActionsWithoutChildren(
                  flowVersion.trigger,
                ),
              ].at(-1)!.name;
              const lastSelectedNode =
                selectedNodes.length === 1 ? selectedNodes[0] : null;
              canvasBulkActions.pasteNodes(
                flowVersion,
                {
                  parentStepName: lastSelectedNode ?? lastStep,
                  stepLocationRelativeToParent:
                    StepLocationRelativeToParent.AFTER,
                },
                applyOperation,
              );
            }
          });
        },
        FitView: () => {
          e.preventDefault();
          fitToView();
        },
        ResetZoom: () => {
          e.preventDefault();
          zoomTo(1, { duration: 0 });
        },
        ZoomIn: () => {
          e.preventDefault();
          zoomIn({ duration: 0 });
        },
        ZoomOut: () => {
          e.preventDefault();
          zoomOut({ duration: 0 });
        },
        AddNote: () => {
          if (readonly) {
            return;
          }
          e.preventDefault();
          setDraggedNote(
            flowCanvasUtils.createNoteDraft(),
            NoteDragOverlayMode.CREATE,
          );
        },
        TidyUp: () => {
          if (readonly) {
            return;
          }
          e.preventDefault();
          tidyUp();
        },
        OpenStepModal: () => {
          const stepToOpen = getSingleSelectedStep({
            selectedNodes,
            selectedStep,
          });
          if (isNil(stepToOpen) || isInteractiveTarget(e.target)) {
            return;
          }
          e.preventDefault();
          openStepModal({ stepName: stepToOpen });
        },
        RenameStep: () => {
          const stepToOpen = getSingleSelectedStep({
            selectedNodes,
            selectedStep,
          });
          if (isNil(stepToOpen) || isInteractiveTarget(e.target)) {
            return;
          }
          e.preventDefault();
          openStepModal({ stepName: stepToOpen, editName: !readonly });
        },
        AddStep: () => {
          if (readonly) {
            return;
          }
          e.preventDefault();
          openAddStepPieceSelector();
        },
        ReplaceStep: () => {
          const stepToReplace = getSingleSelectedStep({
            selectedNodes,
            selectedStep,
          });
          if (
            readonly ||
            isNil(stepToReplace) ||
            isNil(flowStructureUtil.getStep(stepToReplace, flowVersion.trigger))
          ) {
            return;
          }
          e.preventDefault();
          setOpenedPieceSelectorStepNameOrAddButtonId(stepToReplace);
        },
      };
      handlers[match.action]();
    },
    [
      selectedNodes,
      flowVersion,
      applyOperation,
      selectedStep,
      exitStepSettings,
      readonly,
      setDraggedNote,
      tidyUp,
      fitToView,
      zoomIn,
      zoomOut,
      zoomTo,
      isStepModalOpen,
      openStepModal,
      openAddStepPieceSelector,
      setOpenedPieceSelectorStepNameOrAddButtonId,
    ],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
};

function getSingleSelectedStep({
  selectedNodes,
  selectedStep,
}: {
  selectedNodes: string[];
  selectedStep: string | null;
}): string | null {
  if (selectedNodes.length > 1) {
    return null;
  }
  return selectedNodes[0] ?? selectedStep;
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest('button, a, [role="button"], [role="menuitem"]') !== null
  );
}

function matchesShortcut({
  event,
  shortcut,
}: {
  event: Pick<
    KeyboardEvent,
    'key' | 'code' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'
  >;
  shortcut: CanvasShortcutProps;
}): boolean {
  const keyMatches = shortcut.shortcutCode
    ? event.code === shortcut.shortcutCode
    : event.key.toLowerCase() === shortcut.shortcutKey.toLowerCase();
  const ctrlMatches = (event.ctrlKey || event.metaKey) === !!shortcut.withCtrl;
  const shiftMatches =
    !!shortcut.ignoreShift || event.shiftKey === !!shortcut.withShift;
  const altMatches = event.altKey === !!shortcut.withAlt;
  return keyMatches && ctrlMatches && shiftMatches && altMatches;
}

function findShortcutMatch(
  event: Pick<
    KeyboardEvent,
    'key' | 'code' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'
  >,
): ShortcutMatch | null {
  const bindings = CANVAS_SHORTCUT_ACTIONS.flatMap((action) =>
    [CanvasShortcuts[action], ...(CanvasShortcutAliases[action] ?? [])].map(
      (shortcut) => ({ action, shortcut }),
    ),
  );
  return (
    bindings.find(({ shortcut }) => matchesShortcut({ event, shortcut })) ??
    null
  );
}

function isCanvasTarget(target: EventTarget | null): boolean {
  if (target === document.body || target === document.documentElement) {
    return true;
  }
  return (
    target instanceof Element &&
    target.closest(
      `.react-flow, [data-${flowCanvasConsts.CANVAS_CHROME_ATTRIBUTE}]`,
    ) !== null
  );
}

const CANVAS_SHORTCUT_ACTIONS: CanvasShortcutAction[] = [
  'ExitDrag',
  'Paste',
  'Copy',
  'Delete',
  'Skip',
  'FitView',
  'ResetZoom',
  'ZoomIn',
  'ZoomOut',
  'AddNote',
  'TidyUp',
  'OpenStepModal',
  'RenameStep',
  'AddStep',
  'ReplaceStep',
];

export const CanvasShortcuts: CanvasShortcutsProps = {
  ExitDrag: {
    withCtrl: false,
    withShift: false,
    shortcutKey: 'Escape',
  },
  Paste: {
    withCtrl: true,
    withShift: false,
    shortcutKey: 'v',
  },
  Copy: {
    withCtrl: true,
    withShift: false,
    shortcutKey: 'c',
  },
  Delete: {
    shortcutKey: 'Delete',
    requiresCanvasFocus: true,
  },
  Skip: {
    shortcutKey: 'd',
    requiresCanvasFocus: true,
  },
  FitView: {
    shortcutKey: '1',
    requiresCanvasFocus: true,
  },
  ResetZoom: {
    shortcutKey: '0',
    requiresCanvasFocus: true,
  },
  ZoomIn: {
    shortcutKey: '+',
    ignoreShift: true,
    requiresCanvasFocus: true,
  },
  ZoomOut: {
    shortcutKey: '-',
    requiresCanvasFocus: true,
  },
  AddNote: {
    shortcutKey: 's',
    withShift: true,
    requiresCanvasFocus: true,
  },
  TidyUp: {
    shortcutKey: 't',
    shortcutCode: 'KeyT',
    withShift: true,
    withAlt: true,
    requiresCanvasFocus: true,
  },
  OpenStepModal: {
    shortcutKey: 'Enter',
    requiresCanvasFocus: true,
  },
  RenameStep: {
    shortcutKey: 'F2',
    requiresCanvasFocus: true,
  },
  AddStep: {
    shortcutKey: 'n',
    requiresCanvasFocus: true,
  },
  ReplaceStep: {
    shortcutKey: 'r',
    requiresCanvasFocus: true,
  },
};

export const CanvasShortcutAliases: Partial<
  Record<CanvasShortcutAction, CanvasShortcutProps[]>
> = {
  Delete: [
    { shortcutKey: 'Backspace', requiresCanvasFocus: true },
    { shortcutKey: 'Delete', withShift: true },
  ],
  Skip: [{ shortcutKey: 'e', withCtrl: true }],
  ZoomIn: [{ shortcutKey: '=', requiresCanvasFocus: true }],
};

export const TIDY_UP_SHORTCUT: CanvasShortcutProps = CanvasShortcuts.TidyUp;

export const canvasShortcutUtils = {
  matchesShortcut,
  findShortcutMatch,
  isCanvasTarget,
};

type ShortcutMatch = {
  action: CanvasShortcutAction;
  shortcut: CanvasShortcutProps;
};
