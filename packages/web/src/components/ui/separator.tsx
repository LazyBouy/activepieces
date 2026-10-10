import { Separator as SeparatorPrimitive } from 'radix-ui';
import * as React from 'react';

import { cn } from '@/lib/utils';

function Separator({
  className,
  orientation = 'horizontal',
  decorative = true,
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      data-slot="separator"
      decorative={decorative}
      orientation={orientation}
      className={cn(
        'shrink-0 bg-gray-6',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className,
      )}
      {...props}
    />
  );
}

function HorizontalSeparatorWithText({
  className,
  children,
}: HorizontalSeparatorWithTextProps) {
  return (
    <div className={cn('flex w-full flex-row items-center text-sm', className)}>
      <div className="h-px flex-1 bg-gray-6" />
      <span className="mx-2 shrink-0">{children}</span>
      <div className="h-px flex-1 bg-gray-6" />
    </div>
  );
}

export { Separator, HorizontalSeparatorWithText };

type HorizontalSeparatorWithTextProps = {
  className?: string;
  children: React.ReactNode;
};
