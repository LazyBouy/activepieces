import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

const alertVariants = cva(
  "grid gap-0.5 rounded-sm border p-3 text-left text-xs leading-normal has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-18 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-3 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-3.5 group/alert relative w-full",
  {
    variants: {
      variant: {
        default:
          'border-gray-6 bg-panel text-gray-12/87 *:data-[slot=alert-description]:text-gray-12/87 *:[svg]:text-gray-9',
        warning:
          'border-warning-5 bg-warning-2 text-warning-11 *:data-[slot=alert-description]:text-warning-11 *:[svg]:text-warning-11',
        destructive:
          'border-danger-3 bg-danger-2 text-danger-11 *:data-[slot=alert-description]:text-danger-11 *:[svg]:text-danger-11',
        primary:
          'border-accent-5 bg-accent-2 text-accent-11 *:data-[slot=alert-description]:text-accent-11 *:[svg]:text-accent-11',
        success:
          'border-success-5 bg-success-2 text-success-11 *:data-[slot=alert-description]:text-success-11 *:[svg]:text-success-11',
      },
      layout: {
        callout: '',
        notice:
          'rounded-xs border-l-7 p-2 leading-tight text-gray-12 *:data-[slot=alert-description]:text-gray-12 [&_a]:font-semibold [&_a]:text-accent-9',
      },
    },
    compoundVariants: [
      {
        variant: 'default',
        layout: 'notice',
        class:
          'bg-gray-3 text-gray-12 *:data-[slot=alert-description]:text-gray-12',
      },
      {
        variant: 'destructive',
        layout: 'notice',
        class: 'dark:border-l-danger-5',
      },
    ],
    defaultVariants: {
      variant: 'default',
      layout: 'callout',
    },
  },
);

function Alert({
  className,
  variant,
  layout,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      data-layout={layout ?? 'callout'}
      role="alert"
      className={cn(alertVariants({ variant, layout }), className)}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        'font-semibold group-has-[>svg]/alert:col-start-2 [&_a]:font-medium [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-gray-12',
        className,
      )}
      {...props}
    />
  );
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        'text-balance md:text-pretty [&_a]:font-medium [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-gray-12',
        className,
      )}
      {...props}
    />
  );
}

function AlertAction({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-action"
      className={cn('absolute top-2 right-2', className)}
      {...props}
    />
  );
}

export { Alert, AlertTitle, AlertDescription, AlertAction };
