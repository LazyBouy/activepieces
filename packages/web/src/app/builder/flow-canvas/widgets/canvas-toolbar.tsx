import { t } from 'i18next';
import { Plus, Search, StickyNote } from 'lucide-react';

import { useGlobalSearch } from '@/app/components/global-search/global-search-context';
import { useEmbedding } from '@/components/providers/embed-provider';

import { useBuilderStateContext } from '../../builder-hooks';
import { CanvasShortcuts } from '../../shortcuts';
import { NoteDragOverlayMode } from '../../state/notes-state';
import { CanvasControlButton } from '../canvas-controls/canvas-control-button';
import { flowCanvasConsts } from '../utils/consts';
import { flowCanvasUtils } from '../utils/flow-canvas-utils';

const CanvasToolbar = () => {
  const [
    readonly,
    isPiecePanelOpen,
    noteDragOverlayMode,
    setDraggedNote,
    openAddStepPieceSelector,
  ] = useBuilderStateContext((state) => [
    state.readonly,
    state.openedPieceSelectorStepNameOrAddButtonId !== null &&
      state.pieceSelectorOperation !== null,
    state.noteDragOverlayMode,
    state.setDraggedNote,
    state.openAddStepPieceSelector,
  ]);
  const { setOpen: setSearchOpen } = useGlobalSearch();
  const {
    embedState: { hideGlobalSearch },
  } = useEmbedding();

  if (readonly || isPiecePanelOpen) {
    return null;
  }

  return (
    <div
      {...{ [`data-${flowCanvasConsts.CANVAS_CHROME_ATTRIBUTE}`]: true }}
      className="absolute top-4 right-4 z-35 flex flex-col items-center rounded-md bg-panel p-0.5 shadow-xs"
    >
      <CanvasControlButton
        tooltip={t('Add step')}
        icon={Plus}
        tooltipSide="left"
        shortcut={CanvasShortcuts.AddStep}
        onClick={openAddStepPieceSelector}
      />
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
