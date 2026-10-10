import { t } from 'i18next';
import { SearchX } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';

type AutomationsNoResultsStateProps = {
  onClearFilters: () => void;
};

export const AutomationsNoResultsState = ({
  onClearFilters,
}: AutomationsNoResultsStateProps) => {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia>
          <SearchX />
        </EmptyMedia>
        <EmptyTitle>{t('No results found')}</EmptyTitle>
        <EmptyDescription>
          {t(
            "We couldn't find any automations matching your search or filters. Try adjusting your criteria.",
          )}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" size="lg" onClick={onClearFilters}>
          {t('Clear filters')}
        </Button>
      </EmptyContent>
    </Empty>
  );
};
