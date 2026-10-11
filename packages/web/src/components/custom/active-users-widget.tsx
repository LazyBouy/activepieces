import { t } from 'i18next';

import { usePresence } from '@/hooks/use-presence';
import { cn } from '@/lib/utils';

import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

import { ApAvatar } from './ap-avatar';

const MAX_VISIBLE_AVATARS = 5;
const AVATAR_SIZE = 28;
const BORDER_COLORS = [
  'var(--swatch-1-mark)',
  'var(--swatch-3-mark)',
  'var(--swatch-4-mark)',
  'var(--swatch-6-mark)',
  'var(--swatch-8-mark)',
  'var(--swatch-9-mark)',
  'var(--swatch-11-mark)',
  'var(--swatch-12-mark)',
];

function getBorderColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  return BORDER_COLORS[Math.abs(hash) % BORDER_COLORS.length];
}

export function ActiveUsersWidget({
  resourceId,
  appearance = 'default',
}: ActiveUsersWidgetProps) {
  const activeUsers = usePresence({ resourceId });

  if (activeUsers.length === 0) {
    return null;
  }

  const visibleUsers = activeUsers.slice(0, MAX_VISIBLE_AVATARS);
  const overflowCount = activeUsers.length - MAX_VISIBLE_AVATARS;
  const overflow = overflowCount > 0 && (
    <Tooltip>
      <TooltipTrigger asChild>
        {appearance === 'stacked' ? (
          <div className="relative flex size-6 shrink-0 items-center justify-center rounded-full border border-gray-6 bg-panel text-xss font-semibold text-gray-11">
            +{overflowCount}
          </div>
        ) : (
          <div
            className="flex items-center justify-center rounded-full bg-gray-3 text-xs font-medium text-gray-11 border"
            style={{ width: `${AVATAR_SIZE}px`, height: `${AVATAR_SIZE}px` }}
          >
            +{overflowCount}
          </div>
        )}
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {t('+{count} more', { count: overflowCount })}
      </TooltipContent>
    </Tooltip>
  );

  if (appearance === 'stacked') {
    return (
      <div data-active-users className="flex items-center">
        {visibleUsers.map((user, index) => (
          <div
            key={user.userId}
            className={cn('relative h-6 shrink-0', {
              'w-4.5': index < visibleUsers.length - 1 || overflowCount > 0,
              'w-6': index === visibleUsers.length - 1 && overflowCount <= 0,
            })}
          >
            <div className="absolute top-0 left-0 size-6 rounded-full ring-2 ring-panel">
              <ApAvatar id={user.userId} size="small" />
            </div>
          </div>
        ))}
        {overflow}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {visibleUsers.map((user) => (
        <div
          key={user.userId}
          className="rounded-full border-2"
          style={{ borderColor: getBorderColor(user.userId) }}
        >
          <ApAvatar id={user.userId} size="small" />
        </div>
      ))}
      {overflow}
    </div>
  );
}

type ActiveUsersWidgetProps = {
  resourceId: string;
  appearance?: 'default' | 'stacked';
};
