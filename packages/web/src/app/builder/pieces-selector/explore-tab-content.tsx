import { useState } from 'react';

import {
  piecesHooks,
  PieceSelectorTabType,
  ResolvedPieceSelectorTab,
} from '@/features/pieces';

import { useActivatePiecePanelRow } from './piece-actions-or-triggers-list';
import { PiecePanelSubViewHeader } from './piece-panel-header';
import { piecePanelUtils } from './piece-panel-utils';
import { PiecePanelView, PiecePanelViewBaseProps } from './piece-panel-view';

const ExploreTabContent = ({
  tab,
  operation,
  query,
  isTop,
  depth,
  onQueryChange,
  onPush,
  onPop,
  onClose,
}: ExploreTabContentProps) => {
  const [toggledTitles, setToggledTitles] = useState<string[]>([]);
  const activateRow = useActivatePiecePanelRow({ operation, query, onPush });
  const { data: categories, isLoading } = piecesHooks.usePiecesSearch({
    shouldCaptureEvent: false,
    searchQuery: '',
    type: piecePanelUtils.getStepKind(operation),
    tab: { type: PieceSelectorTabType.EXPLORE },
  });
  const rows = piecePanelUtils.buildCategoryRows({
    categories: piecePanelUtils.filterCategories({ categories, query }),
    toggledTitles,
    query,
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
      onActivate={(row) => {
        if (row.kind !== 'category') {
          activateRow(row);
          return;
        }
        setToggledTitles((current) =>
          current.includes(row.title)
            ? current.filter((title) => title !== row.title)
            : [...current, row.title],
        );
      }}
    />
  );
};

export { ExploreTabContent };

type ExploreTabContentProps = PiecePanelViewBaseProps & {
  tab: ResolvedPieceSelectorTab;
};
