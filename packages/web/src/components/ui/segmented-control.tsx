import { cva, type VariantProps } from 'class-variance-authority';
import { RadioGroup as RadioGroupPrimitive } from 'radix-ui';
import * as React from 'react';

import { cn } from '@/lib/utils';

const segmentedControlVariants = cva(
  'group/segmented inline-flex items-stretch gap-0.5 rounded-md bg-gray-5 p-0.5 dark:bg-gray-4 data-[disabled]:cursor-not-allowed data-[disabled]:bg-gray-5',
  {
    variants: {
      size: {
        xs: 'h-6',
        sm: 'h-7',
        default: 'h-8',
        lg: 'h-9',
        xl: 'h-10',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  },
);

const segmentVariants = cva(
  "relative flex flex-1 items-center justify-center gap-1.5 rounded-sm font-medium leading-none whitespace-nowrap text-gray-12/87 transition-colors outline-hidden select-none focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:text-gray-8 data-[state=active]:bg-panel data-[state=active]:text-gray-12 data-[state=checked]:bg-panel data-[state=checked]:text-gray-12 dark:data-[state=active]:bg-gray-1 dark:data-[state=checked]:bg-gray-1 hover:[&:not(:disabled,[data-state=active],[data-state=checked])]:bg-gray-4 hover:[&:not(:disabled,[data-state=active],[data-state=checked])]:text-gray-12 dark:hover:[&:not(:disabled,[data-state=active],[data-state=checked])]:bg-gray-3 group-has-[:focus-visible]/segmented:hover:[&:not([data-state=active],[data-state=checked])]:bg-transparent group-has-[:focus-visible]/segmented:hover:[&:not([data-state=active],[data-state=checked])]:text-gray-12/87 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      size: {
        xs: 'px-2 text-xss',
        sm: 'px-2 text-xss',
        default: 'px-3 text-xs',
        lg: "px-3 text-xsm [&_svg:not([class*='size-'])]:size-4",
        xl: "px-4 text-sm [&_svg:not([class*='size-'])]:size-4",
      },
      iconOnly: {
        true: 'aspect-square flex-none px-0',
        false: '',
      },
    },
    defaultVariants: {
      size: 'default',
      iconOnly: false,
    },
  },
);

function SegmentedControl({
  items,
  size = 'default',
  className,
  ...props
}: SegmentedControlProps) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="segmented-control"
      orientation="horizontal"
      loop
      className={cn(segmentedControlVariants({ size }), className)}
      {...props}
    >
      {items.map((item) => (
        <RadioGroupPrimitive.Item
          key={item.value}
          data-slot="segmented-control-item"
          value={item.value}
          disabled={item.disabled}
          className={cn(
            segmentVariants({ size, iconOnly: item.iconOnly ?? false }),
          )}
        >
          {item.icon}
          {item.iconOnly ? (
            <span className="sr-only">{item.label}</span>
          ) : (
            item.label
          )}
        </RadioGroupPrimitive.Item>
      ))}
    </RadioGroupPrimitive.Root>
  );
}

export { SegmentedControl, segmentedControlVariants, segmentVariants };
export type { SegmentedControlItem, SegmentedControlProps };

type SegmentedControlItem = {
  value: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
  iconOnly?: boolean;
};

type SegmentedControlProps = Omit<
  React.ComponentProps<typeof RadioGroupPrimitive.Root>,
  'children' | 'orientation'
> &
  VariantProps<typeof segmentedControlVariants> & {
    items: SegmentedControlItem[];
  };
