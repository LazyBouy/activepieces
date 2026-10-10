import { t } from 'i18next';
import { Play } from 'lucide-react';
import { useEffect } from 'react';

import { Shortcut, ShortcutProps } from '@/components/custom/shortcut';
import { LoadingSpinner } from '@/components/custom/spinner';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { isEditableTarget, isMac } from '@/lib/dom-utils';
import { cn } from '@/lib/utils';

import { flowCanvasConsts } from '../utils/consts';

const AboveTriggerButton = ({
  onClick,
  text,
  disable = false,
  loading = false,
  showKeyboardShortcut = true,
  shortCutIsEscape = false,
  showPrimaryBg = true,
  icon,
}: AboveTriggerButtonProps) => {
  const isMacSystem = isMac();

  useEffect(() => {
    const keydownHandler = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        return;
      }
      const isEscapePressed = event.key === 'Escape' && shortCutIsEscape;
      const isModifierPressed = isMacSystem ? event.metaKey : event.ctrlKey;
      const key = event.key.toLocaleLowerCase();
      const runShortcutPressed =
        !shortCutIsEscape &&
        isModifierPressed &&
        (key === 'd' || key === 'enter');
      if (isEscapePressed || runShortcutPressed) {
        event.preventDefault();
        event.stopPropagation();
        if (!loading && !disable) {
          onClick();
        }
      }
    };

    window.addEventListener('keydown', keydownHandler, { capture: true });

    return () => {
      window.removeEventListener('keydown', keydownHandler, { capture: true });
    };
  }, [isMacSystem, loading, disable, onClick, shortCutIsEscape]);

  const shortcut: ShortcutProps = shortCutIsEscape
    ? { shortcutKey: 'Esc' }
    : { shortcutKey: 'd', withCtrl: true };

  return (
    <Tooltip delayDuration={flowCanvasConsts.CHROME_TOOLTIP_DELAY}>
      <TooltipTrigger asChild>
        <span className={cn('inline-flex', { 'cursor-not-allowed': disable })}>
          <Button
            variant={showPrimaryBg ? 'default' : 'secondary'}
            size={loading ? 'icon-lg' : 'lg'}
            className={cn('disabled:pointer-events-none', {
              'px-3': !loading,
              'disabled:opacity-100': loading,
            })}
            aria-label={loading ? text : undefined}
            aria-busy={loading || undefined}
            disabled={disable || loading}
            onClick={onClick}
          >
            {loading ? (
              <span
                key="running"
                className="flex items-center justify-center motion-safe:animate-overlay-in"
              >
                <LoadingSpinner
                  className={cn('size-4 [animation-duration:400ms]', {
                    'stroke-on-accent': showPrimaryBg,
                  })}
                />
              </span>
            ) : (
              <span
                key="ready"
                className="flex items-center gap-1.5 motion-safe:animate-overlay-in"
              >
                {icon ?? <Play className="size-4 fill-current" />}
                {text}
              </span>
            )}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">
        {disable ? (
          t('Please test the trigger first')
        ) : (
          <span className="flex items-center gap-2">
            {text}
            {showKeyboardShortcut && <Shortcut {...shortcut} variant="keys" />}
          </span>
        )}
      </TooltipContent>
    </Tooltip>
  );
};

AboveTriggerButton.displayName = 'AboveTriggerButton';

export { AboveTriggerButton };

type AboveTriggerButtonProps = {
  onClick: () => void;
  text: string;
  disable?: boolean;
  loading?: boolean;
  showKeyboardShortcut?: boolean;
  shortCutIsEscape?: boolean;
  showPrimaryBg?: boolean;
  icon?: React.ReactNode;
};
