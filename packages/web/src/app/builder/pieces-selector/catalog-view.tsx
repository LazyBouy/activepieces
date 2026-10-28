import { isNil } from '@activepieces/core-utils';
import { PieceMetadataModelSummary } from '@activepieces/pieces-framework';
import { t } from 'i18next';
import { PackagePlus } from 'lucide-react';
import { useState } from 'react';

import { DataFetchErrorState } from '@/components/custom/data-fetch-error-state';
import { piecesHooks, piecesMutations } from '@/features/pieces';
import { pieceSearchUtils } from '@/features/pieces/utils/piece-search-utils';

import { NoResultsFound } from './no-results-found';
import { PiecePanelSubViewHeader } from './piece-panel-header';
import {
  CatalogDownloadStatus,
  CatalogDownloads,
  piecePanelUtils,
} from './piece-panel-utils';
import { PiecePanelView, PiecePanelViewBaseProps } from './piece-panel-view';

const CatalogView = ({
  operation,
  query,
  isTop,
  depth,
  onQueryChange,
  onPush,
  onPop,
  onClose,
  onAnnounce,
}: PiecePanelViewBaseProps) => {
  const stepKind = piecePanelUtils.getStepKind(operation);
  const { pieces, isLoading, isError, refetch } = piecesHooks.usePieceCatalog();
  const { mutateAsync: downloadPiece } =
    piecesMutations.useDownloadCatalogPiece();
  const routingOn = piecesHooks.useOpencodeRoutingOn();
  const [downloads, setDownloads] = useState<CatalogDownloads>({});
  const modePieces = piecePanelUtils.filterCatalogPieces({
    pieces: pieces ?? [],
    stepKind,
    query: '',
  });
  const rows = piecePanelUtils.buildCatalogRows({
    pieces: piecePanelUtils.filterCatalogPieces({
      pieces: pieces ?? [],
      stepKind,
      query,
    }),
    downloads,
  });
  const showError = isError && isNil(pieces);

  const setStatus = ({
    pieceName,
    status,
  }: {
    pieceName: string;
    status: CatalogDownloadStatus;
  }) =>
    setDownloads((current) =>
      piecePanelUtils.setCatalogDownloadStatus({
        downloads: current,
        pieceName,
        status,
      }),
    );

  const startDownload = (piece: PieceMetadataModelSummary) => {
    if (
      piecePanelUtils.isCatalogDownloadPending({
        downloads,
        pieceName: piece.name,
      })
    ) {
      return;
    }
    setStatus({ pieceName: piece.name, status: 'downloading' });
    downloadPiece({ pieceName: piece.name })
      .then((pieceModel) => {
        setStatus({ pieceName: piece.name, status: 'idle' });
        onAnnounce(
          t('Downloaded {pieceName}', { pieceName: piece.displayName }),
        );
        const metadata = piecePanelUtils.toPieceStepMetadata({
          piece: pieceModel,
          stepKind,
        });
        onPush({
          kind: 'piece',
          metadata: routingOn
            ? pieceSearchUtils.withoutPieceVendorChatActions({
                piece: metadata,
              })
            : metadata,
        });
      })
      .catch(() => {
        setStatus({ pieceName: piece.name, status: 'failed' });
        onAnnounce(
          t("Couldn't download {pieceName}", { pieceName: piece.displayName }),
        );
      });
  };

  return (
    <PiecePanelView
      header={
        <PiecePanelSubViewHeader
          icon={<PackagePlus />}
          title={t('More pieces')}
          description={t('Download a piece to use it in this flow')}
          onBack={onPop}
        />
      }
      query={query}
      onQueryChange={onQueryChange}
      rows={showError ? [] : rows}
      isLoading={isLoading}
      isTop={isTop}
      canPop={depth > 0}
      onPop={onPop}
      onClose={onClose}
      onActivate={(row) => {
        if (row.kind === 'catalog-piece') {
          startDownload(row.piece);
        }
      }}
      emptyState={
        <CatalogEmptyState
          showError={showError}
          isCatalogEmpty={modePieces.length === 0}
          onRetry={refetch}
        />
      }
    />
  );
};

const CatalogEmptyState = ({
  showError,
  isCatalogEmpty,
  onRetry,
}: {
  showError: boolean;
  isCatalogEmpty: boolean;
  onRetry: () => unknown;
}) => {
  if (showError) {
    return (
      <DataFetchErrorState
        entity={t('the catalog')}
        onRetry={onRetry}
        className="h-full"
      />
    );
  }
  if (isCatalogEmpty) {
    return (
      <div
        data-piece-panel-empty
        className="flex h-full items-center justify-center px-6 text-center text-sm text-gray-11"
      >
        {t('Every piece is already downloaded')}
      </div>
    );
  }
  return <NoResultsFound />;
};

export { CatalogView };
