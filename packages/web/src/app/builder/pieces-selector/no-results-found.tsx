import { isNil } from '@activepieces/core-utils';
import { ApFlagId, feedbackUrl } from '@activepieces/shared';
import { t } from 'i18next';
import { MessageSquarePlusIcon, SearchXIcon } from 'lucide-react';

import { useEmbedding } from '@/components/providers/embed-provider';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { flagsHooks } from '@/hooks/flags-hooks';

const NoResultsFound = ({ message }: { message?: string }) => {
  const { data: showCommunityLinks } = flagsHooks.useFlag<boolean>(
    ApFlagId.SHOW_COMMUNITY,
  );
  const isEmbedding = useEmbedding().embedState.isEmbedded;
  const showRequestPieceButton =
    showCommunityLinks && !isEmbedding && isNil(message);

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
      </EmptyHeader>
      {showRequestPieceButton && (
        <EmptyContent>
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
        </EmptyContent>
      )}
    </Empty>
  );
};

export { NoResultsFound };
