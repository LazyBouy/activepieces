import { cva, type VariantProps } from 'class-variance-authority';
import { Tabs as TabsPrimitive } from 'radix-ui';
import * as React from 'react';

import {
  segmentedControlVariants,
  segmentVariants,
} from '@/components/ui/segmented-control';
import { cn } from '@/lib/utils';

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root data-slot="tabs" className={cn(className)} {...props} />
  );
}

const tabsListVariants = cva('inline-flex', {
  variants: {
    variant: {
      default: segmentedControlVariants({ size: 'default' }),
      outline: 'max-w-full items-end overflow-x-auto scrollbar-none',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

const tabsTriggerVariants = cva('inline-flex items-center justify-center', {
  variants: {
    variant: {
      default: segmentVariants({ size: 'default' }),
      outline:
        "gap-1 border-b-2 border-transparent px-4 pt-0 pb-2 text-sm font-medium whitespace-nowrap text-gray-12/87 transition-colors outline-hidden hover:not-disabled:text-accent-9 focus-visible:outline-1 focus-visible:outline-solid focus-visible:-outline-offset-1 focus-visible:outline-focus disabled:cursor-not-allowed disabled:text-gray-8 data-[state=active]:border-accent-9 data-[state=active]:text-accent-9 [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    },
    size: {
      default: '',
      compact: '',
    },
  },
  compoundVariants: [
    {
      variant: 'outline',
      size: 'compact',
      class: 'pb-3 text-xs font-semibold',
    },
  ],
  defaultVariants: {
    variant: 'default',
    size: 'default',
  },
});

function TabsList({
  className,
  variant,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(tabsListVariants({ variant, className }))}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  variant,
  size,
  unread = false,
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger> &
  VariantProps<typeof tabsTriggerVariants> & { unread?: boolean }) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      data-unread={unread || undefined}
      className={cn(tabsTriggerVariants({ variant, size, className }))}
      {...props}
    >
      {children}
      {unread && (
        <span
          data-slot="tabs-unread-dot"
          aria-hidden="true"
          className="size-1.25 shrink-0 rounded-full bg-accent-9"
        />
      )}
    </TabsPrimitive.Trigger>
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn(
        'mt-5 outline-hidden focus-visible:outline-1 focus-visible:outline-solid focus-visible:-outline-offset-1 focus-visible:outline-focus',
        className,
      )}
      {...props}
    />
  );
}

export {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  tabsListVariants,
  tabsTriggerVariants,
};
