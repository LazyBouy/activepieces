import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import * as React from 'react';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex w-fit max-w-full shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border font-medium leading-none whitespace-nowrap transition-colors outline-hidden focus-visible:border-focus focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-0 focus-visible:outline-focus-halo disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60 aria-invalid:border-danger-9 [&>svg]:pointer-events-none [&>svg]:size-3.5 [&>svg]:opacity-90',
  {
    variants: {
      variant: {
        default:
          'border-accent-9 bg-accent-9 text-on-accent clickable-hover:border-accent-10 clickable-hover:bg-accent-10 clickable-active:border-accent-11 clickable-active:bg-accent-11',
        secondary:
          'border-gray-5 bg-gray-5 text-gray-12/87 dark:border-gray-7 dark:bg-gray-7 clickable-hover:border-gray-7 clickable-hover:bg-gray-7 clickable-active:border-gray-7 clickable-active:bg-gray-7 dark:clickable-hover:border-gray-6 dark:clickable-hover:bg-gray-6 dark:clickable-active:border-gray-6 dark:clickable-active:bg-gray-6',
        destructive:
          'border-danger-5 bg-danger-5 text-danger-12 clickable-hover:border-danger-6 clickable-hover:bg-danger-6 clickable-active:border-danger-7 clickable-active:bg-danger-7',
        success:
          'border-success-5 bg-success-5 text-success-12 clickable-hover:border-success-6 clickable-hover:bg-success-6 clickable-active:border-success-7 clickable-active:bg-success-7',
        warning:
          'border-warning-5 bg-warning-5 text-warning-12 clickable-hover:border-warning-6 clickable-hover:bg-warning-6 clickable-active:border-warning-7 clickable-active:bg-warning-7',
        info: 'border-swatch-11-line bg-swatch-11-surface text-swatch-11-ink',
        neutral:
          'border-gray-6 bg-panel text-gray-12/87 shadow-xs clickable-hover:bg-gray-4 clickable-active:bg-gray-4',
        accent:
          'border-gray-5 bg-gray-5 text-gray-12/87 dark:border-gray-7 dark:bg-gray-7 clickable-hover:border-gray-7 clickable-hover:bg-gray-7 clickable-active:border-gray-7 clickable-active:bg-gray-7 dark:clickable-hover:border-gray-6 dark:clickable-hover:bg-gray-6 dark:clickable-active:border-gray-6 dark:clickable-active:bg-gray-6',
        outline:
          'border-gray-6 bg-transparent text-gray-12 clickable-hover:bg-gray-4 clickable-active:bg-gray-4',
        ghost:
          'border-transparent text-gray-12 clickable-hover:bg-gray-4 clickable-active:bg-gray-4',
        link: 'border-transparent text-accent-9 underline-offset-4 hover:underline',
        inverted: 'border-accent-3 bg-accent-3 text-accent-11',
        tag: 'rounded-sm border-gray-4 bg-gray-3 font-normal text-gray-12/87 duration-300 ease-standard dark:border-gray-4 dark:bg-gray-7 clickable-hover:border-gray-5 clickable-hover:bg-gray-4 dark:clickable-hover:border-gray-8 dark:clickable-hover:bg-gray-7 aria-pressed:border-gray-7 aria-pressed:bg-gray-5 aria-selected:border-gray-7 aria-selected:bg-gray-5 data-[state=on]:border-gray-7 data-[state=on]:bg-gray-5',
      },
      size: {
        sm: 'h-5 px-2 text-xs',
        default: 'h-6 px-2 text-xs',
        md: 'h-7 px-2 text-xsm',
        lg: 'h-8 px-3 text-xsm',
        xl: 'h-9 px-4 text-sm [&>svg]:size-5',
        '2xl': 'h-10 px-4 text-sm [&>svg]:size-5',
      },
    },
    compoundVariants: [
      {
        variant: 'tag',
        size: ['sm', 'default'],
        class: 'h-5 px-1 text-xs',
      },
      {
        variant: 'tag',
        size: 'md',
        class: 'h-6 px-2 py-1 text-xsm',
      },
      {
        variant: 'tag',
        size: 'lg',
        class: 'h-7 px-2 py-1 text-xsm',
      },
    ],
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Badge({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'span'> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'span';

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      data-theme={
        variant && LIGHT_ISLAND_VARIANTS.has(variant) ? 'light' : undefined
      }
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  );
}

const LIGHT_ISLAND_VARIANTS = new Set<string>([
  'default',
  'destructive',
  'success',
  'warning',
]);

export { Badge, badgeVariants };
