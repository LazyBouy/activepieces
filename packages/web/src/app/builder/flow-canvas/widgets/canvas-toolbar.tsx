import {
  FlowOperationType,
  StepLocationRelativeToParent,
} from '@activepieces/shared';
import { t } from 'i18next';
import { Plus, Search, StickyNote } from 'lucide-react';

import { useGlobalSearch } from '@/app/components/global-search/global-search-context';
import { useEmbedding } from '@/components/providers/embed-provider';

import { useBuilderStateContext } from '../../builder-hooks';
import { PieceSelector } from '../../pieces-selector';
import { CanvasShortcuts } from '../../shortcuts';
import { NoteDragOverlayMode } from '../../state/notes-state';
import { CanvasControlButton } from '../canvas-controls/canvas-control-button';
import { flowCanvasConsts } from '../utils/consts';
import { flowCanvasUtils } from '../utils/flow-canvas-utils';

const CanvasToolbar = () => {
  const [
    readonly,
    flowVersion,
    selectedStep,
    openedPieceSelectorId,
    noteDragOverlayMode,
    setDraggedNote,
  ] = useBuilderStateContext((state) => [
    state.readonly,
    state.flowVersion,
    state.selectedStep,
    state.openedPieceSelectorStepNameOrAddButtonId,
    state.noteDragOverlayMode,
    state.setDraggedNote,
  ]);
  const { setOpen: setSearchOpen } = useGlobalSearch();
  const {
    embedState: { hideGlobalSearch },
  } = useEmbedding();

  const isAnotherPieceSelectorOpen =
    openedPieceSelectorId !== null &&
    openedPieceSelectorId !== CANVAS_TOOLBAR_ADD_STEP_ID;
  if (readonly || isAnotherPieceSelectorOpen) {
    return null;
  }
  const parentStepName = flowCanvasUtils.getAddStepParentName({
    trigger: flowVersion.trigger,
    selectedStep,
  });

  return (
    <div
      {...{ [`data-${flowCanvasConsts.CANVAS_CHROME_ATTRIBUTE}`]: true }}
      className="absolute top-4 right-4 z-50 flex flex-col items-center rounded-md bg-panel p-0.5 shadow-xs"
    >
      <PieceSelector
        id={CANVAS_TOOLBAR_ADD_STEP_ID}
        operation={{
          type: FlowOperationType.ADD_ACTION,
          actionLocation: {
            parentStep: parentStepName,
            stepLocationRelativeToParent: StepLocationRelativeToParent.AFTER,
          },
        }}
      >
        <span className="inline-flex">
          <CanvasControlButton
            tooltip={t('Add step')}
            icon={Plus}
            tooltipSide="left"
            active={openedPieceSelectorId === CANVAS_TOOLBAR_ADD_STEP_ID}
          />
        </span>
      </PieceSelector>
      {!hideGlobalSearch && (
        <CanvasControlButton
          tooltip={t('Search')}
          icon={Search}
          tooltipSide="left"
          shortcut={{ shortcutKey: 'k', withCtrl: true }}
          onClick={() => setSearchOpen(true)}
        />
      )}
      <CanvasControlButton
        tooltip={t('Add note')}
        icon={StickyNote}
        tooltipSide="left"
        shortcut={CanvasShortcuts.AddNote}
        active={noteDragOverlayMode === NoteDragOverlayMode.CREATE}
        onClick={() =>
          setDraggedNote(
            flowCanvasUtils.createNoteDraft(),
            NoteDragOverlayMode.CREATE,
          )
        }
      />
    </div>
  );
};

CanvasToolbar.displayName = 'CanvasToolbar';
export { CanvasToolbar };

const CANVAS_TOOLBAR_ADD_STEP_ID = 'canvas-toolbar-add-step';
