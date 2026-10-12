import { isNil } from '@activepieces/core-utils';
import { t } from 'i18next';

import {
  piecesHooks,
  PieceStepMetadataWithSuggestions,
  ResolvedPieceSelectorTab,
} from '@/features/pieces';
import { authenticationSession } from '@/lib/authentication-session';

import { NoResultsFound } from '../no-results-found';
import { PiecePanelSubViewHeader } from '../piece-panel-header';
import { piecePanelUtils } from '../piece-panel-utils';
import { PiecePanelViewBaseProps } from '../piece-panel-view';

import { AIPieceActionsList } from './ai-actions-list';

const AITabContent = ({ tab, ...viewProps }: AITabContentProps) => {
  const { pieceModel, isLoading, isError } = piecesHooks.usePiece({
    name: '@activepieces/piece-ai',
    projectId: authenticationSession.getProjectId() ?? undefined,
  });
  const isUnavailable =
    isError ||
    (!isLoading &&
      (isNil(pieceModel) || Object.keys(pieceModel.actions).length === 0));
  const metadata: PieceStepMetadataWithSuggestions | null =
    isNil(pieceModel) || isUnavailable
      ? null
      : piecePanelUtils.toPieceStepMetadata({
          piece: pieceModel,
          stepKind: 'action',
        });
  return (
    <AIPieceActionsList
      {...viewProps}
      header={
        <PiecePanelSubViewHeader
          icon={tab.icon}
          title={tab.name}
          description={null}
          onBack={viewProps.onPop}
        />
      }
      metadata={metadata}
      isLoading={isLoading}
      emptyState={
        isUnavailable ? (
          <NoResultsFound
            message={t('AI piece is not available for this platform')}
          />
        ) : undefined
      }
    />
  );
};

export { AITabContent };

type AITabContentProps = PiecePanelViewBaseProps & {
  tab: ResolvedPieceSelectorTab;
};
