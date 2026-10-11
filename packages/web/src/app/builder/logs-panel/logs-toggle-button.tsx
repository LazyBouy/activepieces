import { t } from 'i18next';
import { ChevronDown, ChevronUp } from 'lucide-react';

import { Shortcut } from '@/components/custom/shortcut';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import { useBuilderStateContext } from '../builder-hooks';
import { flowCanvasConsts } from '../flow-canvas/utils/consts';
import { CanvasShortcuts } from '../shortcuts';

const LogsToggleButton = ({ className }: { className?: string }) => {
  const [isOpen, toggleLogsPanel] = useBuilderStateContext((state) => [
    state.isLogsPanelOpen,
    state.toggleLogsPanel,
  ]);
  const Icon = isOpen ? ChevronDown : ChevronUp;
  return (
    <Tooltip delayDuration={flowCanvasConsts.CHROME_TOOLTIP_DELAY}>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={t('Logs')}
          aria-expanded={isOpen}
          data-logs-toggle
          className={cn('shrink-0', className)}
          onClick={(event) => {
            event.stopPropagation();
            toggleLogsPanel();
          }}
        >
          <Icon className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">
        <span className="flex items-center gap-2">
          {t('Logs')}
          <Shortcut {...CanvasShortcuts.ToggleLogs} variant="keys" />
        </span>
      </TooltipContent>
    </Tooltip>
  );
};

LogsToggleButton.displayName = 'LogsToggleButton';
export { LogsToggleButton };
