import { t } from 'i18next';
import { useState } from 'react';

import {
  piecesHooks,
  PieceSelectorCategoryType,
  PieceSelectorItem,
  PieceSelectorSection,
  PieceSelectorTabType,
  PieceSelectorTriggerListKind,
  ResolvedPieceSelectorTab,
} from '@/features/pieces';

import { aiSectionSource } from './ai-tab-content';
import { NoResultsFound } from './no-results-found';
import {
  useActivatePiecePanelRow,
  usePickPieceSelectorItem,
} from './piece-actions-or-triggers-list';
import { PiecePanelSubViewHeader } from './piece-panel-header';
import { piecePanelUtils } from './piece-panel-utils';
import { PiecePanelView, PiecePanelViewBaseProps } from './piece-panel-view';
import { usePieceSearchResultRows } from './pieces-card-list';
import { triggerOptionDisplay } from './trigger-option-display';

const PieceCategoryView = ({
  tab,
  category,
  ...viewProps
}: PieceCategoryViewProps) => {
  const aiPiece = aiSectionSource.useAiPieceItems({
    enabled: category === PieceSelectorTabType.AI_AND_AGENTS,
  });
  const { sections, isLoading } = piecesHooks.usePieceCategorySections({
    category,
    type: piecePanelUtils.getStepKind(viewProps.operation),
    aiPieceItems: aiPiece.items,
  });
  const canPick = aiSectionSource.useAiActionGate();
  return (
    <SectionListView
      {...viewProps}
      header={
        <PiecePanelSubViewHeader
          icon={tab.icon}
          title={tab.name}
          description={null}
          onBack={viewProps.onPop}
        />
      }
      sections={sections}
      isLoading={isLoading || aiPiece.isLoading}
      getLogoUrl={aiSectionSource.getAiActionLogoUrl}
      captureSearch={category !== PieceSelectorTabType.APPROVALS}
      canPick={canPick}
    />
  );
};

const TriggerListView = ({ list, ...viewProps }: TriggerListViewProps) => {
  const { sections, isLoading } = piecesHooks.useTriggerListSections({
    list,
  });
  const display = triggerOptionDisplay.get(list);
  return (
    <SectionListView
      {...viewProps}
      header={
        <PiecePanelSubViewHeader
          icon={<display.Icon />}
          title={display.title}
          description={null}
          onBack={viewProps.onPop}
        />
      }
      sections={sections}
      isLoading={isLoading}
      captureSearch={true}
      canPick={() => true}
    />
  );
};

const SectionListView = ({
  header,
  sections,
  isLoading,
  getLogoUrl,
  captureSearch,
  canPick,
  operation,
  query,
  isTop,
  depth,
  onQueryChange,
  onPush,
  onPop,
  onClose,
}: SectionListViewProps) => {
  const [collapsedTitles, setCollapsedTitles] = useState<string[]>([]);
  const activateRow = useActivatePiecePanelRow({ operation, query, onPush });
  const pick = usePickPieceSelectorItem({ operation });
  const isCatalogAvailable = piecesHooks.useIsPieceCatalogAvailable();
  const searchResults = usePieceSearchResultRows({ query, operation });
  const isSearching = query !== '';
  const ownRows = piecePanelUtils.buildCategoryRows({
    sections,
    collapsedTitles,
    query,
    getLogoUrl,
  });
  const ownKeys = new Set(ownRows.map((row) => row.key));
  const memberRows = piecePanelUtils.buildCategoryRows({
    sections,
    collapsedTitles: [],
    query: '',
    getLogoUrl,
  });
  const otherRows =
    isSearching && !searchResults.isLoading
      ? piecePanelUtils.buildOtherGroupRows({
          shownRows: memberRows,
          resultRows: searchResults.rows,
          label: t('Found in other groups'),
        })
      : [];
  return (
    <PiecePanelView
      header={header}
      query={query}
      onQueryChange={onQueryChange}
      rows={[...ownRows, ...otherRows]}
      isLoading={
        isLoading ||
        (isSearching && ownRows.length === 0 && searchResults.isLoading)
      }
      isTop={isTop}
      canPop={depth > 0}
      onPop={onPop}
      onClose={onClose}
      onActivate={(row) => {
        switch (row.kind) {
          case 'category':
            setCollapsedTitles((current) =>
              piecePanelUtils.toggleTitle({
                titles: current,
                title: row.title,
              }),
            );
            return;
          case 'item':
            if (!ownKeys.has(row.key)) {
              activateRow(row);
              return;
            }
            if (canPick(row.item)) {
              pick({ item: row.item, query, captureSearch });
            }
            return;
          default:
            activateRow(row);
        }
      }}
      emptyState={
        <NoResultsFound
          onSearchCatalog={
            isCatalogAvailable
              ? () => onPush({ kind: 'catalog', initialQuery: query })
              : undefined
          }
        />
      }
    />
  );
};

export { PieceCategoryView, TriggerListView };

type PieceCategoryViewProps = PiecePanelViewBaseProps & {
  tab: ResolvedPieceSelectorTab;
  category: PieceSelectorCategoryType;
};

type TriggerListViewProps = PiecePanelViewBaseProps & {
  list: PieceSelectorTriggerListKind;
};

type SectionListViewProps = PiecePanelViewBaseProps & {
  header: React.ReactNode;
  sections: PieceSelectorSection[];
  isLoading: boolean;
  getLogoUrl?: (item: PieceSelectorItem) => string | undefined;
  captureSearch: boolean;
  canPick: (item: PieceSelectorItem) => boolean;
};
