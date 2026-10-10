import { t } from 'i18next';
import {
  Check,
  CircleX,
  History,
  LucideIcon,
  Pause,
  Pin,
  RouteOff,
  TriangleAlert,
} from 'lucide-react';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import { StepCornerIcon } from '../../utils/canvas-run-utils';
import { flowCanvasConsts } from '../../utils/consts';

const StepNodeCornerIcon = ({ corner }: { corner: StepCornerIcon }) => {
  const { Icon, className } = CORNER_ICONS[corner.kind];
  const tooltip = getCornerTooltip(corner);
  const count = corner.kind === 'success' ? corner.count : null;
  const content = (
    <div
      data-step-corner={corner.kind}
      className={cn(
        'absolute right-1.5 bottom-1.5 flex items-center gap-0.5',
        className,
      )}
    >
      <Icon className="size-4" />
      {count !== null && (
        <span className="text-sm leading-none font-semibold">{count}</span>
      )}
    </div>
  );
  if (tooltip === null) {
    return content;
  }
  return (
    <Tooltip delayDuration={flowCanvasConsts.STATUS_TOOLTIP_DELAY}>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent side="bottom">{tooltip}</TooltipContent>
    </Tooltip>
  );
};

function getCornerTooltip(corner: StepCornerIcon): string | null {
  switch (corner.kind) {
    case 'failed':
      return corner.tooltip;
    case 'incomplete':
      return t('Incomplete');
    case 'changed':
      return t('This step has been updated since the last test');
    default:
      return null;
  }
}

const CORNER_ICONS: Record<
  StepCornerIcon['kind'],
  { Icon: LucideIcon; className: string }
> = {
  success: { Icon: Check, className: 'text-canvas-success' },
  failed: { Icon: CircleX, className: 'text-canvas-danger' },
  paused: { Icon: Pause, className: 'text-canvas-warning' },
  pinned: { Icon: Pin, className: 'text-canvas-pinned' },
  incomplete: { Icon: TriangleAlert, className: 'text-canvas-danger' },
  changed: { Icon: History, className: 'text-canvas-warning' },
  skipped: { Icon: RouteOff, className: 'text-canvas-muted-icon' },
};

export { StepNodeCornerIcon };
