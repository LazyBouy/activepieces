import { TelemetryEventName } from '@activepieces/shared';
import { t } from 'i18next';

import { useTelemetry } from '@/components/providers/telemetry-provider';
import {
  PieceIcon,
  PieceSelectorItem,
  PieceSelectorOperation,
  PieceStepMetadataWithSuggestions,
  stepsHooks,
} from '@/features/pieces';

import { useBuilderStateContext } from '../builder-hooks';

import { PiecePanelSubViewHeader } from './piece-panel-header';
import {
  PiecePanelRow,
  PiecePanelViewModel,
  piecePanelUtils,
} from './piece-panel-utils';
import { PiecePanelView, PiecePanelViewBaseProps } from './piece-panel-view';

export const PieceActionsOrTriggersList = ({
  metadata,
  operation,
  query,
  isTop,
  depth,
  onQueryChange,
  onPop,
  onClose,
}: PieceActionsOrTriggersListProps) => {
  const stepKind = piecePanelUtils.getStepKind(operation);
  const { metadata: allSteps } = stepsHooks.useAllStepsMetadata({
    searchQuery: '',
    type: stepKind,
  });
  const fullMetadata =
    allSteps
      ?.filter(piecePanelUtils.isPieceMetadata)
      .find((step) => step.pieceName === metadata.pieceName) ?? metadata;
  const pick = usePickPieceSelectorItem({ operation });
  const items = piecePanelUtils.filterItems({
    items: piecePanelUtils.getItems(fullMetadata),
    query,
  });
  const rows = piecePanelUtils.buildLabelledItemRows({
    label: stepKind === 'trigger' ? t('Triggers') : t('Actions'),
    items,
    keyPrefix: `piece:${metadata.pieceName}`,
  });
  return (
    <PiecePanelView
      header={
        <PiecePanelSubViewHeader
          icon={
            <PieceIcon
              logoUrl={fullMetadata.logoUrl}
              displayName={fullMetadata.displayName}
              showTooltip={false}
              size="row"
            />
          }
          title={fullMetadata.displayName}
          description={
            fullMetadata.description
              ? piecePanelUtils.trimTrailingPeriod(fullMetadata.description)
              : null
          }
          onBack={onPop}
        />
      }
      query={query}
      onQueryChange={onQueryChange}
      rows={rows}
      isLoading={false}
      isTop={isTop}
      canPop={depth > 0}
      onPop={onPop}
      onClose={onClose}
      onActivate={(row) => {
        if (row.kind === 'item') {
          pick({ item: row.item, query });
        }
      }}
    />
  );
};

export function usePickPieceSelectorItem({
  operation,
}: {
  operation: PieceSelectorOperation;
}) {
  const { capture } = useTelemetry();
  const handleAddingOrUpdatingStep = useBuilderStateContext(
    (state) => state.handleAddingOrUpdatingStep,
  );
  return ({
    item,
    query,
    captureSearch = true,
  }: {
    item: PieceSelectorItem;
    query: string;
    captureSearch?: boolean;
  }) => {
    if (captureSearch && piecePanelUtils.isPieceItem(item)) {
      capture({
        name: TelemetryEventName.PIECE_SELECTOR_SEARCH,
        payload: {
          search: query,
          isTrigger: piecePanelUtils.getItemInfo(item).isTrigger,
          selectedActionOrTriggerName: item.actionOrTrigger.name,
        },
      });
    }
    handleAddingOrUpdatingStep({
      pieceSelectorItem: item,
      operation,
      selectStepAfter: true,
    });
  };
}

export function useActivatePiecePanelRow({
  operation,
  query,
  onPush,
}: {
  operation: PieceSelectorOperation;
  query: string;
  onPush: (view: PiecePanelViewModel) => void;
}) {
  const pick = usePickPieceSelectorItem({ operation });
  return (row: PiecePanelRow) => {
    switch (row.kind) {
      case 'group':
        onPush({ kind: 'group', tab: row.tab });
        return;
      case 'piece':
        onPush({ kind: 'piece', metadata: row.metadata });
        return;
      case 'browse-catalog':
        onPush({ kind: 'catalog', initialQuery: '' });
        return;
      case 'item':
        pick({ item: row.item, query });
        return;
      default:
        return;
    }
  };
}

type PieceActionsOrTriggersListProps = PiecePanelViewBaseProps & {
  metadata: PieceStepMetadataWithSuggestions;
};
