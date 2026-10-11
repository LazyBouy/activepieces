import { ArrowRight } from 'lucide-react';

import { CardListOption } from '@/components/custom/card-list';
import { TextWithTooltip } from '@/components/custom/text-with-tooltip';
import { PieceIcon, PieceStepMetadataWithSuggestions } from '@/features/pieces';

import { piecePanelUtils } from './piece-panel-utils';

const PieceCardListItem = ({
  pieceMetadata,
  showDescription,
  id,
  active,
  hoverEnabled,
  onClick,
}: PieceCardListItemProps) => {
  const description = showDescription
    ? piecePanelUtils.trimTrailingPeriod(pieceMetadata.description ?? '')
    : '';
  return (
    <CardListOption
      id={id}
      active={active}
      hoverEnabled={hoverEnabled}
      onClick={onClick}
      data-testid={pieceMetadata.displayName}
      className="min-h-12 gap-4 py-3 pr-2 pl-4"
    >
      <PieceIcon
        logoUrl={pieceMetadata.logoUrl}
        displayName={pieceMetadata.displayName}
        showTooltip={false}
        size="list"
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <TextWithTooltip tooltipMessage={pieceMetadata.displayName}>
          <div className="text-sm leading-4.5 font-medium text-gray-12">
            {pieceMetadata.displayName}
          </div>
        </TextWithTooltip>
        {description !== '' && (
          <div className="mt-0.5 line-clamp-2 text-xs leading-4 text-gray-11">
            {description}
          </div>
        )}
      </div>
      <ArrowRight className="size-4 shrink-0 text-gray-11 group-hover/option:text-gray-12" />
    </CardListOption>
  );
};

PieceCardListItem.displayName = 'PieceCardListItem';
export { PieceCardListItem };

type PieceCardListItemProps = {
  pieceMetadata: PieceStepMetadataWithSuggestions;
  showDescription: boolean;
  id: string;
  active: boolean;
  hoverEnabled: boolean;
  onClick: () => void;
};
