import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import * as React from 'react';

import { Shortcut } from '@/components/custom/shortcut';
import { LoadingSpinner } from '@/components/custom/spinner';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'relative inline-flex shrink-0 items-center justify-center gap-1.5 font-medium leading-none whitespace-nowrap transition-[color,background-color,box-shadow] outline-hidden focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-0 focus-visible:outline-focus-halo pressed:duration-0 disabled:cursor-not-allowed disabled:opacity-50 data-[loading=true]:cursor-default data-[loading=true]:opacity-100 aria-invalid:inset-ring-danger-9 aria-invalid:focus-visible:outline-danger-9/20 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-accent-9 stroke-on-accent text-on-accent inset-ring inset-ring-accent-9 shadow-xs enabled:hover:bg-accent-10 enabled:hover:inset-ring-accent-10 pressed:bg-accent-11 pressed:inset-ring-accent-11 focus-visible:inset-ring-focus',
        basic:
          'text-accent-9 underline-offset-4 enabled:hover:bg-gray-4 pressed:bg-gray-5',
        secondary:
          'bg-panel text-gray-12 inset-ring inset-ring-gray-6 shadow-xs enabled:hover:bg-gray-4 enabled:hover:inset-ring-gray-7 enabled:hover:text-gray-12 pressed:bg-gray-5 pressed:inset-ring-gray-8 focus-visible:inset-ring-focus',
        destructive:
          'bg-danger-9 text-on-danger inset-ring inset-ring-danger-9 shadow-sm enabled:hover:bg-danger-11 enabled:hover:inset-ring-danger-11 pressed:bg-danger-11 pressed:inset-ring-danger-11 focus-visible:inset-ring-focus',
        outline:
          'bg-panel text-gray-12 inset-ring inset-ring-gray-6 shadow-xs enabled:hover:bg-gray-4 enabled:hover:inset-ring-gray-7 enabled:hover:text-gray-12 pressed:bg-gray-5 pressed:inset-ring-gray-8 focus-visible:inset-ring-focus',
        accent:
          'bg-transparent text-gray-12 inset-ring inset-ring-gray-6 enabled:hover:bg-gray-4 enabled:hover:inset-ring-gray-7 pressed:bg-gray-5 pressed:inset-ring-gray-8 focus-visible:inset-ring-focus',
        ghost:
          'text-gray-12 hover:bg-gray-4 hover:text-gray-12 pressed:bg-gray-5',
        link: 'text-accent-9 underline-offset-4 hover:text-accent-10 hover:underline',
        transparent: 'text-accent-9 enabled:hover:bg-transparent',
      },
      size: {
        default:
          "h-8 rounded-sm px-3 text-sm [&_svg:not([class*='size-'])]:size-3.5",
        xs: "h-6 rounded-sm px-2 text-xs [&_svg:not([class*='size-'])]:size-2.5",
        sm: "h-7 rounded-sm px-3 text-xsm [&_svg:not([class*='size-'])]:size-3",
        lg: "h-9 rounded-md px-4 text-sm [&_svg:not([class*='size-'])]:size-4",
        xl: "h-10 rounded-lg px-4 text-base [&_svg:not([class*='size-'])]:size-5",
        icon: "size-8 rounded-sm text-sm [&_svg:not([class*='size-'])]:size-4",
        'icon-xs':
          "size-6 rounded-sm text-xs [&_svg:not([class*='size-'])]:size-3",
        'icon-sm':
          "size-7 rounded-sm text-xsm [&_svg:not([class*='size-'])]:size-3.5",
        'icon-lg':
          "size-9 rounded-md text-sm [&_svg:not([class*='size-'])]:size-4",
      },
    },
    compoundVariants: [
      {
        variant: 'link',
        class: 'px-0',
      },
    ],
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function useKeyboardShortcut(
  keyboardShortcut: string | undefined,
  disabled: boolean | undefined,
  onKeyboardShortcut: (() => void) | undefined,
) {
  React.useEffect(() => {
    if (!keyboardShortcut) return;

    const isMac = /(Mac)/i.test(navigator.userAgent);
    const isEscape = keyboardShortcut.toLocaleLowerCase() === 'esc';

    const handleKeyDown = (event: KeyboardEvent) => {
      const isEscapePressed = event.key === 'Escape' && isEscape;
      const isCtrlWithShortcut =
        event.key === keyboardShortcut.toLocaleLowerCase() &&
        (isMac ? event.metaKey : event.ctrlKey);

      if (isEscapePressed || isCtrlWithShortcut) {
        event.preventDefault();
        event.stopPropagation();
        if (onKeyboardShortcut && !disabled) {
          onKeyboardShortcut();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [keyboardShortcut, disabled, onKeyboardShortcut]);
}

function renderButtonContent({
  asChild,
  loading,
  variant,
  size,
  keyboardShortcut,
  keyboardShortcutClassName,
  children,
}: ButtonContentParams) {
  const content = keyboardShortcut ? (
    <div className="flex justify-center items-center gap-2">
      {children}
      <Shortcut
        shortcutKey={keyboardShortcut}
        withCtrl={true}
        className={cn(
          {
            'text-on-accent/70': variant === 'default',
            'text-on-danger/70': variant === 'destructive',
          },
          keyboardShortcutClassName,
        )}
      />
    </div>
  ) : (
    children
  );

  if (!loading) {
    return content;
  }

  const spinner = (
    <LoadingSpinner
      className={cn(
        'animate-spin [animation-duration:400ms]',
        SPINNER_SIZE_CLASSES[size ?? 'default'],
        {
          'stroke-on-accent': variant === 'default',
          'stroke-on-danger': variant === 'destructive',
          'stroke-gray-12': variant !== 'default' && variant !== 'destructive',
        },
      )}
    />
  );

  if (asChild) {
    return spinner;
  }

  return (
    <>
      <span
        data-slot="button-label"
        aria-hidden="true"
        className="flex items-center justify-center gap-[inherit] motion-safe:animate-fade-down-out motion-reduce:animate-swap-out"
      >
        {content}
      </span>
      <span
        data-slot="button-spinner"
        className="absolute inset-0 flex items-center justify-center motion-safe:animate-loader-in motion-reduce:animate-swap-in"
      >
        {spinner}
      </span>
    </>
  );
}

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  loading = false,
  keyboardShortcut,
  keyboardShortcutClassName,
  onKeyboardShortcut,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : 'button';

  useKeyboardShortcut(
    keyboardShortcut,
    disabled || loading,
    onKeyboardShortcut,
  );

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      data-loading={loading || undefined}
      aria-busy={loading || undefined}
      data-theme={
        variant === 'default' || variant === 'destructive' ? 'light' : undefined
      }
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || loading}
      {...props}
      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
        if (loading) {
          e.stopPropagation();
        } else if (props.onClick) {
          props.onClick(e);
        }
      }}
    >
      {renderButtonContent({
        asChild,
        loading,
        variant,
        size,
        keyboardShortcut,
        keyboardShortcutClassName,
        children,
      })}
    </Comp>
  );
}

const SPINNER_SIZE_CLASSES: Record<NonNullable<ButtonProps['size']>, string> = {
  default: 'size-3.5',
  xs: 'size-2.5',
  sm: 'size-3',
  lg: 'size-4',
  xl: 'size-5',
  icon: 'size-4',
  'icon-xs': 'size-3',
  'icon-sm': 'size-3.5',
  'icon-lg': 'size-4',
};

export { Button, buttonVariants };
export type { ButtonProps };

type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    loading?: boolean;
    keyboardShortcut?: string;
    keyboardShortcutClassName?: string;
    onKeyboardShortcut?: () => void;
  };

type ButtonContentParams = {
  asChild: boolean;
  loading: boolean;
  variant: ButtonProps['variant'];
  size: ButtonProps['size'];
  keyboardShortcut: string | undefined;
  keyboardShortcutClassName: string | undefined;
  children: React.ReactNode;
};
