import { isNil } from '@activepieces/core-utils';
import { AI_PIECE_NAME, ApFlagId, FlowActionType } from '@activepieces/shared';
import { t } from 'i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { piecesHooks, PieceSelectorItem } from '@/features/pieces';
import { aiProviderQueries } from '@/features/platform-admin';
import { flagsHooks } from '@/hooks/flags-hooks';
import { authenticationSession } from '@/lib/authentication-session';

import { piecePanelUtils } from '../piece-panel-utils';

function useAiPieceItems({ enabled }: { enabled: boolean }): {
  items: PieceSelectorItem[];
  isLoading: boolean;
} {
  const { data: aiProviders, isLoading: isLoadingProviders } =
    aiProviderQueries.useProjectAiProviders();
  const hasProviders = !isNil(aiProviders) && aiProviders.length > 0;
  const { pieceModel, isLoading, isError } = piecesHooks.usePiece({
    name: AI_PIECE_NAME,
    projectId: authenticationSession.getProjectId() ?? undefined,
    enabled: enabled && hasProviders,
  });
  if (!enabled || !hasProviders) {
    return { items: [], isLoading: enabled && isLoadingProviders };
  }
  if (isError || isNil(pieceModel)) {
    return { items: [], isLoading };
  }
  return {
    items: piecePanelUtils.getItems(
      piecePanelUtils.toPieceStepMetadata({
        piece: pieceModel,
        stepKind: 'action',
      }),
    ),
    isLoading: false,
  };
}

function useAiActionGate(): (item: PieceSelectorItem) => boolean {
  const { data: isAgentsConfigured } = flagsHooks.useFlag<boolean>(
    ApFlagId.AGENTS_CONFIGURED,
  );
  const navigate = useNavigate();
  return (item) => {
    if (!isAiPieceItem(item) || isAgentsConfigured) {
      return true;
    }
    toast(t('Connect to OpenAI'), {
      description: t(
        "To create an agent, you'll first need to connect to OpenAI in platform settings.",
      ),
      action: {
        label: t('Set up'),
        onClick: () => {
          navigate('/platform/ai');
        },
      },
    });
    return false;
  };
}

function getAiActionLogoUrl(item: PieceSelectorItem): string | undefined {
  if (!isAiPieceItem(item) || item.type !== FlowActionType.PIECE) {
    return undefined;
  }
  return ACTION_ICON_MAP[item.actionOrTrigger.name] ?? FALLBACK_AI_ICON;
}

function isAiPieceItem(item: PieceSelectorItem): boolean {
  return (
    piecePanelUtils.isPieceItem(item) &&
    item.pieceMetadata.pieceName === AI_PIECE_NAME
  );
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

export const aiSectionSource = {
  useAiPieceItems,
  useAiActionGate,
  getAiActionLogoUrl,
};
