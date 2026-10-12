import { t } from 'i18next';
import { ArrowRight } from 'lucide-react';

import { CardListOption } from '@/components/custom/card-list';
import { TextWithTooltip } from '@/components/custom/text-with-tooltip';

import { PieceSelectorTabType } from '../stores/piece-selector-tabs-provider';
import { ResolvedPieceSelectorTab } from '../utils/piece-selector-customization';

export const PieceSelectorTabRow = ({
  tab,
  ...optionProps
}: PieceSelectorTabRowProps) => {
  return (
    <PieceSelectorGroupRow
      groupKey={tab.key}
      icon={tab.icon}
      title={tab.name}
      description={getTabDescription(tab.type)}
      {...optionProps}
    />
  );
};

export const PieceSelectorGroupRow = ({
  groupKey,
  icon,
  title,
  description,
  opensList = true,
  id,
  active,
  hoverEnabled,
  onClick,
}: PieceSelectorGroupRowProps) => {
  return (
    <CardListOption
      id={id}
      active={active}
      hoverEnabled={hoverEnabled}
      onClick={onClick}
      data-piece-panel-group={groupKey}
      className="min-h-12 gap-4 py-3 pr-2 pl-4"
    >
      <span className="flex shrink-0 text-gray-11 [&>svg]:size-5">{icon}</span>
      <div className="flex min-w-0 flex-1 flex-col">
        <TextWithTooltip tooltipMessage={title}>
          <div className="text-sm leading-4.5 font-medium text-gray-12">
            {title}
          </div>
        </TextWithTooltip>
        {description && (
          <TextWithTooltip tooltipMessage={description}>
            <div className="mt-0.5 truncate text-xs leading-4 text-gray-11">
              {description}
            </div>
          </TextWithTooltip>
        )}
      </div>
      {opensList && (
        <ArrowRight className="size-4 shrink-0 text-gray-11 group-hover/option:text-gray-12" />
      )}
    </CardListOption>
  );
};

function getTabDescription(type: PieceSelectorTabType): string | null {
  switch (type) {
    case PieceSelectorTabType.AI_AND_AGENTS:
      return t('Run agents, ask models and use AI services');
    case PieceSelectorTabType.APPS:
      return t('Work with the apps and services you connect');
    case PieceSelectorTabType.DATA_TRANSFORMATION:
      return t('Reshape text, dates, numbers and files');
    case PieceSelectorTabType.FLOW_CONTROL:
      return t('Route, repeat, wait or call another flow');
    case PieceSelectorTabType.UTILITY:
      return t('HTTP, webhooks, code, storage and other building blocks');
    case PieceSelectorTabType.APPROVALS:
      return t('Wait for someone to approve or answer');
    case PieceSelectorTabType.CUSTOM:
    case PieceSelectorTabType.NONE:
      return null;
  }
}

type PieceSelectorRowOptionProps = {
  id: string;
  active: boolean;
  hoverEnabled: boolean;
  onClick: () => void;
};

type PieceSelectorTabRowProps = PieceSelectorRowOptionProps & {
  tab: ResolvedPieceSelectorTab;
};

type PieceSelectorGroupRowProps = PieceSelectorRowOptionProps & {
  groupKey: string;
  icon: React.ReactNode;
  title: string;
  description: string | null;
  opensList?: boolean;
};
