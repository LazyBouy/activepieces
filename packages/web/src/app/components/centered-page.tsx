import React from 'react';

import { PageHeader } from '@/components/custom/page-header';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export const CenteredPage = ({
  title,
  description,
  actions,
  footer,
  breadcrumb,
  children,
  widthClassName = 'max-w-[40rem]',
  className,
}: {
  title?: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  breadcrumb?: React.ReactNode;
  children: React.ReactNode;
  widthClassName?: string;
  className?: string;
}) => {
  const hasHeader = title !== undefined || !!description || !!actions;
  const header = (
    <>
      {breadcrumb && <div className="pt-4 md:pt-6">{breadcrumb}</div>}
      {hasHeader && (
        <PageHeader
          title={title}
          description={description}
          rightContent={actions}
          className={cn({
            'min-h-0 pt-3 pb-4 md:min-h-0 md:pt-3': !!breadcrumb,
          })}
        />
      )}
    </>
  );

  if (!footer) {
    return (
      <div className={cn('w-full pb-6', className)}>
        {header}
        <div className={cn('w-full', widthClassName)}>{children}</div>
      </div>
    );
  }

  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      <div className="shrink-0">{header}</div>
      <ScrollArea className="min-h-0 flex-1">
        <div className={cn('w-full pb-6', widthClassName)}>{children}</div>
      </ScrollArea>
      <div className="shrink-0 border-t bg-gray-1 py-3">
        <div className={cn('flex w-full justify-end gap-2', widthClassName)}>
          {footer}
        </div>
      </div>
    </div>
  );
};
