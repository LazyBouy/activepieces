import { ReactNode } from 'react';

import { TextWithTooltip } from '@/components/custom/text-with-tooltip';
import { useEmbedding } from '@/components/providers/embed-provider';
import { cn, DASHBOARD_CONTENT_PADDING_X } from '@/lib/utils';

export const PageHeader = ({
  title,
  description,
  leftContent,
  rightContent,
  className = '',
}: PageHeaderProps) => {
  const { embedState } = useEmbedding();

  if (embedState.hidePageHeader) {
    return null;
  }

  return (
    <div
      data-slot="page-header"
      className={cn(
        'sticky top-0 z-30 flex min-h-20 w-full shrink-0 items-start justify-between gap-4 bg-gray-1 pt-4 md:min-h-22 md:pt-6',
        DASHBOARD_CONTENT_PADDING_X,
        className,
      )}
    >
      <div className="flex min-w-0 grow items-center gap-1">
        <div className="flex min-w-0 grow flex-col">
          {typeof title === 'string' ? (
            <TextWithTooltip tooltipMessage={title}>
              <h1 className="text-xl font-semibold leading-tight text-gray-12">
                {title}
              </h1>
            </TextWithTooltip>
          ) : (
            title
          )}
          {description && (
            <span className="text-sm text-gray-11">{description}</span>
          )}
        </div>
        {leftContent}
      </div>
      {rightContent && (
        <div className="flex shrink-0 items-center gap-2">{rightContent}</div>
      )}
    </div>
  );
};

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  leftContent?: ReactNode;
  rightContent?: ReactNode;
  className?: string;
}
