import { unique } from '@activepieces/core-utils';
import { AgentToolType } from '@activepieces/shared';
import { t } from 'i18next';
import { BookOpen, LucideIcon, Server, Unplug, Workflow } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { PieceIcon } from '@/features/pieces/components/piece-icon';
import { piecesHooks } from '@/features/pieces/hooks/pieces-hooks';
import { cn } from '@/lib/utils';

const MAX_VISIBLE = 3;

type AgentToolStackProps = {
  toolCount: number;
  toolPieceNames: string[];
  toolTypes?: AgentToolType[];
  size?: 'default' | 'compact';
};

export const AgentToolStack = ({
  toolCount,
  toolPieceNames,
  toolTypes = [],
  size = 'default',
}: AgentToolStackProps) => {
  const compact = size === 'compact';
  const { summaries } = piecesHooks.usePieceSummariesByNames({
    names: unique(toolPieceNames),
  });

  if (toolCount === 0) {
    return (
      <span
        className={cn(
          'flex items-center gap-1.5 text-gray-11',
          compact ? 'text-xs' : 'text-[13px] leading-5',
        )}
      >
        <Unplug size={compact ? 12 : 14} className="text-gray-11" />
        {t('No tools')}
      </span>
    );
  }

  const tiles = [
    ...summaries.map((metadata) => ({
      tools: toolPieceNames.filter((name) => name === metadata.name).length,
      element: (
        <PieceIcon
          key={metadata.name}
          logoUrl={metadata.logoUrl}
          displayName={metadata.displayName}
          showTooltip={true}
          size={compact ? 'xxs' : 'xs'}
          border={true}
        />
      ),
    })),
    ...NON_PIECE_TOOL_KINDS.flatMap(({ type, icon: Icon, label }) => {
      const count = toolTypes.filter((toolType) => toolType === type).length;
      if (count === 0) {
        return [];
      }
      return [
        {
          tools: count,
          element: (
            <Tooltip key={type}>
              <TooltipTrigger asChild>
                <span
                  className={cn(
                    'flex items-center justify-center border bg-gray-1 text-gray-11',
                    compact ? 'size-4 rounded-sm' : 'size-6.5 rounded-md',
                  )}
                >
                  <Icon size={compact ? 10 : 14} />
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {count > 1 ? `${t(label)} · ${count}` : t(label)}
              </TooltipContent>
            </Tooltip>
          ),
        },
      ];
    }),
  ];
  const visible = tiles.slice(0, MAX_VISIBLE);
  const remaining =
    toolCount - visible.reduce((shown, tile) => shown + tile.tools, 0);

  return (
    <div
      className={cn(
        'flex shrink-0 items-center',
        compact ? 'gap-1' : 'gap-[5px]',
      )}
    >
      {visible.map((tile) => tile.element)}
      {remaining > 0 &&
        (compact ? (
          <Badge variant="tag" size="sm">
            +{remaining}
          </Badge>
        ) : (
          <span className="flex size-6.25 items-center justify-center rounded-[7px] bg-gray-3 text-xs leading-none font-semibold text-gray-11">
            +{remaining}
          </span>
        ))}
    </div>
  );
};

const NON_PIECE_TOOL_KINDS: {
  type: AgentToolType;
  icon: LucideIcon;
  label: string;
}[] = [
  {
    type: AgentToolType.KNOWLEDGE_BASE,
    icon: BookOpen,
    label: 'Knowledge Base',
  },
  { type: AgentToolType.FLOW, icon: Workflow, label: 'Flows' },
  { type: AgentToolType.MCP, icon: Server, label: 'MCP Servers' },
];
