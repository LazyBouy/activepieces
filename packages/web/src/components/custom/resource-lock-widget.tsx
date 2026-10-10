import { t } from 'i18next';
import { Lock } from 'lucide-react';

import { Button } from '@/components/ui/button';

function ResourceLockWidget({
  lockedBy,
  takeOver,
  resourceLabel,
}: ResourceLockWidgetProps) {
  return (
    <div className="pointer-events-none absolute top-10 z-40 flex w-full justify-center px-4">
      <div className="pointer-events-auto flex max-w-full items-center justify-between gap-3 rounded-sm border border-gray-6 bg-panel p-3 text-xs leading-normal text-gray-12/87 motion-safe:animate-overlay-in">
        <div className="flex items-center gap-3">
          <Lock className="size-3.5 shrink-0 text-gray-9" />
          <span>
            {t(
              '{name} is editing this {resource}. Only one person can edit at a time.',
              {
                name: lockedBy.userDisplayName,
                resource: resourceLabel,
              },
            )}
          </span>
        </div>
        <Button variant="ghost" size="xs" onClick={takeOver}>
          {t('Take Over')}
        </Button>
      </div>
    </div>
  );
}

ResourceLockWidget.displayName = 'ResourceLockWidget';
export { ResourceLockWidget };

type ResourceLockWidgetProps = {
  lockedBy: {
    userId: string;
    userDisplayName: string;
  };
  takeOver: () => void;
  resourceLabel: string;
};
