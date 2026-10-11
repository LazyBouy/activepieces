import { ApFlagId, FlowActionType } from '@activepieces/shared';
import { t } from 'i18next';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import {
  PieceSelectorItem,
  PieceStepMetadataWithSuggestions,
} from '@/features/pieces';
import { flagsHooks } from '@/hooks/flags-hooks';

import { usePickPieceSelectorItem } from '../piece-actions-or-triggers-list';
import { piecePanelUtils } from '../piece-panel-utils';
import { PiecePanelView, PiecePanelViewBaseProps } from '../piece-panel-view';

export const AIPieceActionsList = ({
  header,
  metadata,
  isLoading,
  emptyState,
  operation,
  query,
  isTop,
  depth,
  onQueryChange,
  onPop,
  onClose,
}: AIPieceActionsListProps) => {
  const pick = usePickPieceSelectorItem({ operation });
  const { data: isAgentsConfigured } = flagsHooks.useFlag<boolean>(
    ApFlagId.AGENTS_CONFIGURED,
  );
  const navigate = useNavigate();
  const rows =
    metadata === null
      ? []
      : piecePanelUtils.buildLabelledItemRows({
          label: null,
          items: piecePanelUtils.filterItems({
            items: piecePanelUtils.getItems(metadata),
            query,
          }),
          keyPrefix: 'ai',
          getLogoUrl: getAiActionIcon,
        });
  return (
    <PiecePanelView
      header={header}
      query={query}
      onQueryChange={onQueryChange}
      rows={rows}
      isLoading={isLoading}
      isTop={isTop}
      canPop={depth > 0}
      onPop={onPop}
      onClose={onClose}
      emptyState={emptyState}
      onActivate={(row) => {
        if (row.kind !== 'item') {
          return;
        }
        if (!isAgentsConfigured) {
          toast('Connect to OpenAI', {
            description: t(
              "To create an agent, you'll first need to connect to OpenAI in platform settings.",
            ),
            action: {
              label: 'Set Up',
              onClick: () => {
                navigate('/platform/ai');
              },
            },
          });
          return;
        }
        pick({ item: row.item, query });
      }}
    />
  );
};

function getAiActionIcon(item: PieceSelectorItem): string | undefined {
  return item.type === FlowActionType.PIECE
    ? ACTION_ICON_MAP[item.actionOrTrigger.name]
    : FALLBACK_AI_ICON;
}

const FALLBACK_AI_ICON =
  'https://cdn.activepieces.com/pieces/new-core/image-ai.svg';

const ACTION_ICON_MAP: Record<string, string> = {
  run_agent: 'https://cdn.activepieces.com/pieces/new-core/agent.svg',
  generateImage: 'https://cdn.activepieces.com/pieces/new-core/image-ai.svg',
  askAi: 'https://cdn.activepieces.com/pieces/new-core/text-ai.svg',
  summarizeText: 'https://cdn.activepieces.com/pieces/new-core/text-ai.svg',
  classifyText: 'https://cdn.activepieces.com/pieces/new-core/text-ai.svg',
  extractStructuredData:
    'https://cdn.activepieces.com/pieces/new-core/utility-ai.svg',
};

type AIPieceActionsListProps = PiecePanelViewBaseProps & {
  header: React.ReactNode;
  metadata: PieceStepMetadataWithSuggestions | null;
  isLoading: boolean;
  emptyState: React.ReactNode;
};
