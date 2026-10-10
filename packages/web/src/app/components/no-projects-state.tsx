import { t } from 'i18next';
import { FolderOpen } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';

export const NoProjectsState = () => {
  return (
    <div className="flex h-full w-full items-center justify-center px-4 py-12">
      <Empty className="max-w-2xl flex-none">
        <EmptyHeader>
          <EmptyMedia>
            <FolderOpen />
          </EmptyMedia>
          <EmptyTitle>
            {t("You're all signed in, but you've got no projects yet.")}
          </EmptyTitle>
          <EmptyDescription>
            {t(
              "You haven't been added to a project. Ask your workspace admin to invite you and you'll be up and running in no time.",
            )}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Badge variant="inverted" className="gap-1.5">
            <span aria-hidden className="size-1.5 rounded-full bg-accent-10" />
            {t('Waiting for access')}
          </Badge>
        </EmptyContent>
      </Empty>
    </div>
  );
};
