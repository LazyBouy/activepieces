'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import { CheckIcon, MinusIcon } from 'lucide-react';
import { Checkbox as CheckboxPrimitive } from 'radix-ui';
import * as React from 'react';

import { cn } from '@/lib/utils';

const checkboxVariants = cva(
  'peer size-4 shrink-0 rounded-sm border border-gray-6 bg-panel transition-colors outline-hidden enabled:hover:data-[state=unchecked]:border-accent-9 focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:bg-gray-3 aria-invalid:border-danger-9',
  {
    variants: {
      variant: {
        primary:
          'data-[state=checked]:border-accent-9 data-[state=checked]:bg-accent-9 data-[state=checked]:text-on-accent data-[state=indeterminate]:border-accent-9 data-[state=indeterminate]:bg-accent-9 data-[state=indeterminate]:text-on-accent disabled:data-[state=checked]:border-gray-5 disabled:data-[state=checked]:bg-gray-5 disabled:data-[state=checked]:text-gray-8 disabled:data-[state=indeterminate]:border-gray-5 disabled:data-[state=indeterminate]:bg-gray-5 disabled:data-[state=indeterminate]:text-gray-8',
        secondary:
          'data-[state=checked]:bg-gray-12 data-[state=checked]:text-gray-1 data-[state=checked]:border-gray-12 data-[state=indeterminate]:bg-gray-12 data-[state=indeterminate]:text-gray-1 data-[state=indeterminate]:border-gray-12',
      },
    },
    defaultVariants: {
      variant: 'primary',
    },
  },
);

function Checkbox({ className, variant, checked, ...props }: CheckboxProps) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      checked={checked}
      className={cn(checkboxVariants({ variant }), className)}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none"
      >
        {checked === 'indeterminate' ? (
          <MinusIcon className="size-3 text-current" />
        ) : (
          <CheckIcon className="size-3 text-current" />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox, checkboxVariants };

type CheckboxProps = React.ComponentProps<typeof CheckboxPrimitive.Root> &
  VariantProps<typeof checkboxVariants>;

export type { CheckboxProps };
