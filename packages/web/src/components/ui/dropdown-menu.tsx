'use client';

import { CheckIcon, ChevronRightIcon, CircleIcon } from 'lucide-react';
import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui';
import * as React from 'react';

import { cn } from '@/lib/utils';

import { MenuScrollFade } from './menu-scroll-fade';

function DropdownMenu({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}

function DropdownMenuPortal({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Portal>) {
  return (
    <DropdownMenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />
  );
}

function DropdownMenuTrigger({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
  return (
    <DropdownMenuPrimitive.Trigger
      data-slot="dropdown-menu-trigger"
      {...props}
    />
  );
}

function DropdownMenuContent({
  className,
  sideOffset = 4,
  noAnimationOnOut = false,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content> & {
  noAnimationOnOut?: boolean;
}) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        data-no-exit-animation={noAnimationOnOut || undefined}
        sideOffset={sideOffset}
        className={cn(
          'z-70 max-h-[min(var(--radix-dropdown-menu-content-available-height),75vh)] min-w-32 origin-(--radix-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto scrollbar-hover rounded-lg bg-panel p-1 text-gray-12 shadow-float outline-hidden data-[state=open]:motion-safe:animate-float-in',
          className,
        )}
        {...props}
      >
        {children}
        <MenuScrollFade />
      </DropdownMenuPrimitive.Content>
    </DropdownMenuPrimitive.Portal>
  );
}

function DropdownMenuGroup({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Group>) {
  return (
    <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />
  );
}

function DropdownMenuItem({
  className,
  inset,
  variant = 'default',
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  inset?: boolean;
  variant?: 'default' | 'destructive';
}) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "relative flex min-h-8 cursor-pointer items-center gap-2 rounded-md p-2 text-sm leading-tight text-gray-12 outline-hidden select-none transition-colors focus:bg-gray-4 focus:text-gray-12 data-[disabled]:pointer-events-none data-[disabled]:text-gray-8 data-[disabled]:[&_svg:not([class*='text-'])]:text-gray-8 data-[inset]:pl-8 data-[variant=destructive]:text-danger-11 data-[variant=destructive]:focus:bg-danger-3 data-[variant=destructive]:focus:text-danger-11 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-gray-11 data-[variant=destructive]:*:[svg]:text-danger-11!",
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      className={cn(
        "relative flex min-h-8 cursor-default items-center gap-2 rounded-md py-2 pr-2 pl-8 text-sm leading-tight text-gray-12 outline-hidden select-none transition-colors focus:bg-gray-4 focus:text-gray-12 data-[disabled]:pointer-events-none data-[disabled]:text-gray-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      checked={checked}
      {...props}
    >
      <span className="pointer-events-none absolute left-0 flex w-8 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <CheckIcon className="size-4 text-gray-12" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  );
}

function DropdownMenuRadioGroup({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioGroup>) {
  return (
    <DropdownMenuPrimitive.RadioGroup
      data-slot="dropdown-menu-radio-group"
      {...props}
    />
  );
}

function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
  return (
    <DropdownMenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      className={cn(
        "relative flex min-h-8 cursor-default items-center gap-2 rounded-md py-2 pr-2 pl-8 text-sm leading-tight text-gray-12 outline-hidden select-none transition-colors focus:bg-gray-4 focus:text-gray-12 data-[disabled]:pointer-events-none data-[disabled]:text-gray-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      <span className="pointer-events-none absolute left-0 flex w-8 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <CircleIcon className="size-2 fill-current text-gray-12" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  );
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label> & {
  inset?: boolean;
}) {
  return (
    <DropdownMenuPrimitive.Label
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn(
        'px-2 pt-2 pb-1.5 text-xs font-medium text-gray-11 data-[inset]:pl-8',
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn('-mx-1 my-0.5 h-px bg-gray-6', className)}
      {...props}
    />
  );
}

function DropdownMenuShortcut({
  className,
  keyboardShortcut,
  onKeyboardShortcut,
  ...props
}: DropdownMenuShortcutProps) {
  React.useEffect(() => {
    if (keyboardShortcut) {
      const handler = createKeyDownHandler(
        keyboardShortcut,
        onKeyboardShortcut,
      );
      document.addEventListener('keydown', handler);
      return () => {
        document.removeEventListener('keydown', handler);
      };
    }
  }, [keyboardShortcut, onKeyboardShortcut]);

  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn('ml-auto text-xs tracking-widest text-gray-11', className)}
      {...props}
    >
      {'\u2318'}
      {keyboardShortcut.toString().toLocaleUpperCase()}
    </span>
  );
}

function DropdownMenuSub({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Sub>) {
  return <DropdownMenuPrimitive.Sub data-slot="dropdown-menu-sub" {...props} />;
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> & {
  inset?: boolean;
}) {
  return (
    <DropdownMenuPrimitive.SubTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        "flex min-h-8 cursor-default items-center gap-2 rounded-md p-2 text-sm leading-tight text-gray-12 outline-hidden select-none transition-colors focus:bg-gray-4 focus:text-gray-12 data-[inset]:pl-8 data-[state=open]:bg-gray-4 data-[state=open]:text-gray-12 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-gray-11",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto size-4" />
    </DropdownMenuPrimitive.SubTrigger>
  );
}

function DropdownMenuSubContent({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubContent>) {
  return (
    <DropdownMenuPrimitive.SubContent
      data-slot="dropdown-menu-sub-content"
      className={cn(
        'z-70 max-w-96 min-w-32 origin-(--radix-dropdown-menu-content-transform-origin) overflow-hidden rounded-lg bg-panel p-1 text-gray-12 shadow-float outline-hidden data-[state=open]:motion-safe:animate-float-in',
        className,
      )}
      {...props}
    />
  );
}

// Helper functions

function createKeyDownHandler(
  keyboardShortcut: string,
  onKeyboardShortcut: () => void,
) {
  return (event: KeyboardEvent) => {
    if (
      event.key === keyboardShortcut?.toLocaleLowerCase() &&
      (event.metaKey || event.ctrlKey)
    ) {
      event.preventDefault();
      event.stopPropagation();
      if (onKeyboardShortcut) {
        onKeyboardShortcut();
      }
    }
  };
}

// Type definitions

type DropdownMenuShortcutProps = React.ComponentProps<'span'> & {
  keyboardShortcut: string;
  onKeyboardShortcut: () => void;
};

export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
};
