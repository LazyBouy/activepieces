import { PieceMetadataModelSummary } from '@activepieces/pieces-framework';
import { t } from 'i18next';
import { Download } from 'lucide-react';

import { CardListOption } from '@/components/custom/card-list';
import { LoadingSpinner } from '@/components/custom/spinner';
import { TextWithTooltip } from '@/components/custom/text-with-tooltip';
import { PieceIcon } from '@/features/pieces';

import { CatalogDownloadStatus, piecePanelUtils } from './piece-panel-utils';

const CatalogPieceRow = ({
  piece,
  status,
  id,
  active,
  hoverEnabled,
  onClick,
}: CatalogPieceRowProps) => {
  const description = piecePanelUtils.trimTrailingPeriod(piece.description);
  const isDownloading = status === 'downloading';
  return (
    <CardListOption
      id={id}
      active={active}
      hoverEnabled={hoverEnabled}
      onClick={onClick}
      aria-busy={isDownloading || undefined}
      data-piece-panel-catalog-piece={piece.displayName}
      data-piece-panel-catalog-status={status}
      className="min-h-12 gap-4 py-3 pr-2 pl-4"
    >
      <PieceIcon
        logoUrl={piece.logoUrl}
        displayName={piece.displayName}
        showTooltip={false}
        size="list"
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <TextWithTooltip tooltipMessage={piece.displayName}>
          <div className="text-sm leading-4.5 font-medium text-gray-12">
            {piece.displayName}
          </div>
        </TextWithTooltip>
        {description !== '' && (
          <div className="mt-0.5 truncate text-xs leading-4 text-gray-11">
            {description}
          </div>
        )}
        {status === 'failed' && (
          <div
            data-piece-panel-catalog-error
            className="mt-0.5 text-xs leading-4 text-danger-11"
          >
            {t("Couldn't download. Try again.")}
          </div>
        )}
      </div>
      {isDownloading ? (
        <span className="flex shrink-0 items-center gap-1.5 text-xs leading-4 text-gray-11">
          <LoadingSpinner className="size-3.5 stroke-gray-11 motion-reduce:animate-none" />
          {t('Downloading…')}
        </span>
      ) : (
        <span className="flex shrink-0 items-center gap-1.5 text-xs leading-4 text-gray-11 group-hover/option:text-gray-12">
          <Download aria-hidden className="size-3.5" />
          {t('Download')}
        </span>
      )}
    </CardListOption>
  );
};

CatalogPieceRow.displayName = 'CatalogPieceRow';
export { CatalogPieceRow };

type CatalogPieceRowProps = {
  piece: PieceMetadataModelSummary;
  status: CatalogDownloadStatus;
  id: string;
  active: boolean;
  hoverEnabled: boolean;
  onClick: () => void;
};
