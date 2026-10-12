import { isNil } from '@activepieces/core-utils';
import { ApFlagId, feedbackUrl } from '@activepieces/shared';
import { t } from 'i18next';
import { MessageSquarePlusIcon, SearchXIcon } from 'lucide-react';

import { useEmbedding } from '@/components/providers/embed-provider';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { flagsHooks } from '@/hooks/flags-hooks';

const NoResultsFound = ({
  message,
  onSearchCatalog,
}: {
  message?: string;
  onSearchCatalog?: () => void;
}) => {
  const { data: showCommunityLinks } = flagsHooks.useFlag<boolean>(
    ApFlagId.SHOW_COMMUNITY,
  );
  const isEmbedding = useEmbedding().embedState.isEmbedded;
  const showRequestPieceButton =
    showCommunityLinks && !isEmbedding && isNil(message);
  const showCatalogHint = !isNil(onSearchCatalog);

  return (
    <Empty
      data-piece-panel-empty
      className="h-full gap-3 rounded-none border-0 px-6 py-0"
    >
      <EmptyHeader className="gap-2">
        <EmptyMedia className="mb-0 text-gray-11">
          <SearchXIcon className="size-6" />
        </EmptyMedia>
        <EmptyTitle className="text-sm font-semibold tracking-normal">
          {message ?? t('No results')}
        </EmptyTitle>
        {showCatalogHint && (
          <EmptyDescription className="text-sm text-gray-11">
            {t('Not here? Search the catalog')}
          </EmptyDescription>
        )}
      </EmptyHeader>
      {(showCatalogHint || showRequestPieceButton) && (
        <EmptyContent className="gap-3">
          {showCatalogHint && (
            <Button
              variant="secondary"
              size="sm"
              data-piece-panel-search-catalog
              onClick={onSearchCatalog}
            >
              {t('Search the catalog')}
            </Button>
          )}
          {showRequestPieceButton && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                window.open(`${feedbackUrl}`, '_blank', 'noopener noreferrer');
              }}
            >
              <MessageSquarePlusIcon className="size-3" />
              {t('Request Piece')}
            </Button>
          )}
        </EmptyContent>
      )}
    </Empty>
  );
};

export { NoResultsFound };
