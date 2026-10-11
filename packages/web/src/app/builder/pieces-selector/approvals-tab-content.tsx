import { isNil } from '@activepieces/core-utils';
import { FlowActionType } from '@activepieces/shared';

import {
  piecesHooks,
  PieceSelectorItem,
  ResolvedPieceSelectorTab,
  stepUtils,
} from '@/features/pieces';

import { usePickPieceSelectorItem } from './piece-actions-or-triggers-list';
import { PiecePanelSubViewHeader } from './piece-panel-header';
import { piecePanelUtils } from './piece-panel-utils';
import { PiecePanelView, PiecePanelViewBaseProps } from './piece-panel-view';

const APPROVAL_PIECES_CONFIG = [
  {
    pieceName: '@activepieces/piece-slack',
    approvalActionNames: [
      'request_approval_message',
      'request_approval_direct_message',
    ],
  },
  {
    pieceName: '@activepieces/piece-discord',
    approvalActionNames: ['request_approval_message'],
  },
  {
    pieceName: '@activepieces/piece-microsoft-teams',
    approvalActionNames: [
      'request_approval_direct_message',
      'request_approval_in_channel',
    ],
  },
  {
    pieceName: '@activepieces/piece-microsoft-outlook',
    approvalActionNames: ['request_approval_in_mail'],
  },
  {
    pieceName: '@activepieces/piece-gmail',
    approvalActionNames: ['request_approval_in_mail'],
  },
  {
    pieceName: '@activepieces/piece-telegram-bot',
    approvalActionNames: ['request_approval_message'],
  },
];

const ApprovalsTabContent = ({
  tab,
  operation,
  query,
  isTop,
  depth,
  onQueryChange,
  onPop,
  onClose,
}: ApprovalsTabContentProps) => {
  const pick = usePickPieceSelectorItem({ operation });
  const pieceQueries = piecesHooks.useMultiplePieces({
    names: APPROVAL_PIECES_CONFIG.map((config) => config.pieceName),
  });
  const isLoading = pieceQueries.some((query) => query.isLoading);
  const approvalItems: PieceSelectorItem[] = pieceQueries.flatMap(
    (pieceQuery) => {
      const piece = pieceQuery.data;
      if (isNil(piece)) {
        return [];
      }
      const config = APPROVAL_PIECES_CONFIG.find(
        (candidate) => candidate.pieceName === piece.name,
      );
      if (isNil(config)) {
        return [];
      }
      const pieceMetadata = stepUtils.mapPieceToMetadata({
        piece,
        type: 'action',
      });
      return config.approvalActionNames
        .map((actionName) => piece.actions[actionName])
        .filter((action) => !isNil(action))
        .map((action) => ({
          actionOrTrigger: action,
          type: FlowActionType.PIECE,
          pieceMetadata,
        }));
    },
  );
  const rows = piecePanelUtils.buildLabelledItemRows({
    label: null,
    items: piecePanelUtils.filterItems({ items: approvalItems, query }),
    keyPrefix: 'approvals',
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
        if (row.kind === 'item') {
          pick({ item: row.item, query, captureSearch: false });
        }
      }}
    />
  );
};

export { ApprovalsTabContent };

type ApprovalsTabContentProps = PiecePanelViewBaseProps & {
  tab: ResolvedPieceSelectorTab;
};
