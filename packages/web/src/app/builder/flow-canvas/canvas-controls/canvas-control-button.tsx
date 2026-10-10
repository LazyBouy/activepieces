import { LucideIcon } from 'lucide-react';

import { Shortcut, ShortcutProps } from '@/components/custom/shortcut';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import { flowCanvasConsts } from '../utils/consts';

const CanvasControlButton = ({
  tooltip,
  icon: Icon,
  iconClassName,
  active = false,
  disabled = false,
  shortcut,
  tooltipSide = 'top',
  onClick,
}: CanvasControlButtonProps) => {
  return (
    <Tooltip delayDuration={flowCanvasConsts.CHROME_TOOLTIP_DELAY}>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-lg"
          aria-label={tooltip}
          aria-disabled={disabled || undefined}
          data-active={active || undefined}
          className={cn('data-[active=true]:bg-gray-5', {
            'cursor-not-allowed opacity-50 hover:bg-transparent': disabled,
          })}
          onClick={() => {
            if (!disabled) {
              onClick?.();
            }
          }}
        >
          <Icon className={cn('size-4', iconClassName)} />
        </Button>
      </TooltipTrigger>
      <TooltipContent side={tooltipSide}>
        <span className="flex items-center gap-2">
          {tooltip}
          {shortcut && <Shortcut {...shortcut} variant="keys" />}
        </span>
      </TooltipContent>
    </Tooltip>
  );
};

export { CanvasControlButton };

type CanvasControlButtonProps = {
  tooltip: string;
  icon: LucideIcon;
  iconClassName?: string;
  active?: boolean;
  disabled?: boolean;
  shortcut?: ShortcutProps;
  tooltipSide?: 'top' | 'left' | 'right' | 'bottom';
  onClick?: () => void;
};
