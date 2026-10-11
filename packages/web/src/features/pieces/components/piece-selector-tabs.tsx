import { t } from 'i18next';
import { ArrowRight } from 'lucide-react';

import { CardListOption } from '@/components/custom/card-list';
import { TextWithTooltip } from '@/components/custom/text-with-tooltip';

import { PieceSelectorTabType } from '../stores/piece-selector-tabs-provider';
import { ResolvedPieceSelectorTab } from '../utils/piece-selector-customization';

export const PieceSelectorTabRow = ({
  tab,
  id,
  active,
  hoverEnabled,
  onClick,
}: PieceSelectorTabRowProps) => {
  const description = getTabDescription(tab.type);
  return (
    <CardListOption
      id={id}
      active={active}
      hoverEnabled={hoverEnabled}
      onClick={onClick}
      data-piece-panel-group={tab.key}
      className="min-h-12 gap-4 py-3 pr-2 pl-4"
    >
      <span className="flex shrink-0 text-gray-11 [&>svg]:size-5">
        {tab.icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <TextWithTooltip tooltipMessage={tab.name}>
          <div className="text-sm leading-4.5 font-medium text-gray-12">
            {tab.name}
          </div>
        </TextWithTooltip>
        {description && (
          <div className="mt-0.5 truncate text-xs leading-4 text-gray-11">
            {description}
          </div>
        )}
      </div>
      <ArrowRight className="size-4 shrink-0 text-gray-11 group-hover/option:text-gray-12" />
    </CardListOption>
  );
};

function getTabDescription(type: PieceSelectorTabType): string | null {
  switch (type) {
    case PieceSelectorTabType.EXPLORE:
      return t('Popular pieces to get started');
    case PieceSelectorTabType.AI_AND_AGENTS:
      return t('Use AI models and agents in this flow');
    case PieceSelectorTabType.APPS:
      return t('Do something in an app or service');
    case PieceSelectorTabType.UTILITY:
      return t('Code, loops, routers, HTTP and other core tools');
    case PieceSelectorTabType.APPROVALS:
      return t('Pause the flow until someone responds');
    case PieceSelectorTabType.CUSTOM:
    case PieceSelectorTabType.NONE:
      return null;
  }
}

type PieceSelectorTabRowProps = {
  tab: ResolvedPieceSelectorTab;
  id: string;
  active: boolean;
  hoverEnabled: boolean;
  onClick: () => void;
};
