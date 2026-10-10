import { FlowCreator, FlowCreatorType } from '@activepieces/shared';
import { t } from 'i18next';

import { McpSvg } from '@/assets/img/custom/mcp';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type FlowCreatedByBadgeProps = {
  createdBy: FlowCreator | null | undefined;
  className?: string;
};

export const FlowCreatedByBadge = ({
  createdBy,
  className,
}: FlowCreatedByBadgeProps) => {
  if (!createdBy || createdBy.type !== FlowCreatorType.MCP) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          size="sm"
          className={cn('shrink-0', className)}
        >
          <McpSvg className="size-3" />
          {t('AI')}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="bottom">{t('Created by AI')}</TooltipContent>
    </Tooltip>
  );
};
