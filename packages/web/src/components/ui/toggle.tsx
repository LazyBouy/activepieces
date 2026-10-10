'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import { Toggle as TogglePrimitive } from 'radix-ui';
import * as React from 'react';

import { cn } from '@/lib/utils';

const toggleVariants = cva(
  "inline-flex items-center justify-center gap-1.5 text-sm font-medium leading-none whitespace-nowrap text-gray-12 transition-[color,background-color,box-shadow] outline-hidden hover:bg-gray-4 hover:text-gray-12 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-0 focus-visible:outline-focus-halo disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:inset-ring-danger-9 data-[state=on]:bg-gray-5 data-[state=on]:text-gray-12 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-transparent',
        outline:
          'bg-panel inset-ring inset-ring-gray-6 shadow-xs hover:bg-gray-4 hover:text-gray-12',
      },
      size: {
        default: 'h-8 min-w-8 rounded-sm px-2',
        sm: 'h-7 min-w-7 rounded-sm px-2',
        lg: 'h-9 min-w-9 rounded-md px-2',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Toggle({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> &
  VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Toggle, toggleVariants };
