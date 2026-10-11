import { Zap } from 'lucide-react';

import { CardListOption } from '@/components/custom/card-list';
import { TextWithTooltip } from '@/components/custom/text-with-tooltip';
import { Badge } from '@/components/ui/badge';
import { PieceIcon, PieceSelectorItem } from '@/features/pieces';
import { ACTION_CLASSIFICATION_BADGES } from '@/features/pieces/utils/action-classification';

import { piecePanelUtils } from './piece-panel-utils';

const GenericActionOrTriggerItem = ({
  item,
  logoUrl,
  logoName,
  hideLogo,
  id,
  active,
  hoverEnabled,
  disabled = false,
  onClick,
}: GenericActionOrTriggerItemProps) => {
  const info = piecePanelUtils.getItemInfo(item);
  const description = piecePanelUtils.trimTrailingPeriod(
    info.description ?? '',
  );
  return (
    <CardListOption
      id={id}
      active={active}
      hoverEnabled={hoverEnabled}
      disabled={disabled}
      onClick={onClick}
      data-piece-panel-item={info.displayName}
      className="min-h-12 gap-4 py-3 pr-2 pl-4"
    >
      {hideLogo ? (
        <span aria-hidden className="size-6 shrink-0" />
      ) : (
        <PieceIcon
          logoUrl={logoUrl}
          displayName={logoName}
          showTooltip={false}
          size="list"
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-w-0 items-center">
          <TextWithTooltip tooltipMessage={info.displayName}>
            <div className="min-w-0 text-sm leading-4.5 font-medium text-gray-12">
              {info.displayName}
            </div>
          </TextWithTooltip>
          {info.isTrigger && (
            <Zap
              aria-hidden
              className="ml-1 size-3 shrink-0 fill-accent-9 text-accent-9"
            />
          )}
          {info.classification && (
            <Badge variant="accent" className="ml-1.5 h-5 shrink-0 px-1.5">
              {ACTION_CLASSIFICATION_BADGES[info.classification].label()}
            </Badge>
          )}
        </div>
        {description !== '' && (
          <div className="mt-0.5 line-clamp-2 text-xs leading-4 text-gray-11">
            {description}
          </div>
        )}
      </div>
    </CardListOption>
  );
};

GenericActionOrTriggerItem.displayName = 'GenericActionOrTriggerItem';
export { GenericActionOrTriggerItem };

type GenericActionOrTriggerItemProps = {
  item: PieceSelectorItem;
  logoUrl: string;
  logoName: string;
  hideLogo: boolean;
  id: string;
  active: boolean;
  hoverEnabled: boolean;
  disabled?: boolean;
  onClick: () => void;
};
