import { useDebounce } from 'use-debounce';

import {
  piecesHooks,
  PieceSelectorOperation,
  PieceSelectorTabType,
  ResolvedPieceSelectorTab,
} from '@/features/pieces';

import { useActivatePiecePanelRow } from './piece-actions-or-triggers-list';
import { PiecePanelSubViewHeader } from './piece-panel-header';
import { PiecePanelRow, piecePanelUtils } from './piece-panel-utils';
import { PiecePanelView, PiecePanelViewBaseProps } from './piece-panel-view';

export const PiecesCardList = ({
  tab,
  operation,
  query,
  isTop,
  depth,
  onQueryChange,
  onPush,
  onPop,
  onClose,
}: PiecesCardListProps) => {
  const activateRow = useActivatePiecePanelRow({ operation, query, onPush });
  const { data: categories, isLoading } = piecesHooks.usePiecesSearch({
    shouldCaptureEvent: false,
    searchQuery: '',
    type: piecePanelUtils.getStepKind(operation),
    tab: { type: tab.type, customTabId: tab.customTabId ?? null },
  });
  const rows = piecePanelUtils.buildSectionRows({
    categories: piecePanelUtils.filterCategories({ categories, query }),
  });
  return (
    <PiecePanelView
      header={
        <PiecePanelSubViewHeader
          icon={tab.icon}
          title={tab.name}
          description={null}
          onBack={onPop}
        />
      }
      query={query}
      onQueryChange={onQueryChange}
      rows={rows}
      isLoading={isLoading}
      isTop={isTop}
      canPop={depth > 0}
      onPop={onPop}
      onClose={onClose}
      onActivate={activateRow}
    />
  );
};

export function usePieceSearchResultRows({
  query,
  operation,
}: {
  query: string;
  operation: PieceSelectorOperation;
}): { rows: PiecePanelRow[]; isLoading: boolean } {
  const [debouncedQuery] = useDebounce(query, SEARCH_DEBOUNCE_MS);
  const effectiveQuery = query === '' ? '' : debouncedQuery;
  const { data: categories, isLoading } = piecesHooks.usePiecesSearch({
    shouldCaptureEvent: true,
    searchQuery: effectiveQuery,
    enabled: effectiveQuery !== '',
    type: piecePanelUtils.getStepKind(operation),
    tab: { type: PieceSelectorTabType.NONE },
  });
  if (effectiveQuery === '' || isLoading) {
    return { rows: [], isLoading: true };
  }
  return {
    rows: piecePanelUtils.buildSearchResultRows({ categories }),
    isLoading: false,
  };
}

const SEARCH_DEBOUNCE_MS = 300;

type PiecesCardListProps = PiecePanelViewBaseProps & {
  tab: ResolvedPieceSelectorTab;
};
