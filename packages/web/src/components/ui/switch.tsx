import { Switch as SwitchPrimitive } from 'radix-ui';
import * as React from 'react';

import { cn } from '@/lib/utils';

function Switch({
  className,
  checkedIcon,
  uncheckedIcon,
  onCheckedChange,
  variant = 'default',
  size = 'default',
  color = 'default',
  indeterminate = false,
  ...props
}: SwitchProps) {
  const isControlled = props.checked !== undefined;

  const [internalChecked, setInternalChecked] = React.useState(
    props.defaultChecked ?? false,
  );
  const isChecked = isControlled ? props.checked : internalChecked;

  const effectiveCheckedIcon = checkedIcon;
  const effectiveUncheckedIcon = uncheckedIcon || checkedIcon;
  const icon = isChecked ? effectiveCheckedIcon : effectiveUncheckedIcon;

  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'group/switch peer inline-flex shrink-0 cursor-pointer items-center p-0.5 transition-[background-color,box-shadow] outline-hidden focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-60',
        COLOR_CLASSES[color],
        indeterminate ? INDETERMINATE_CLASSES : UNCHECKED_CLASSES,
        variant === 'square' ? 'rounded-md' : 'rounded-full',
        SIZE_CLASSES[size],
        className,
      )}
      onCheckedChange={(checked) =>
        handleCheckedChange(
          checked,
          isControlled,
          setInternalChecked,
          onCheckedChange,
        )
      }
      {...props}
      data-indeterminate={indeterminate || undefined}
      checked={isChecked}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          'pointer-events-none flex items-center justify-center bg-panel shadow-[0_1px_2px_0_rgb(0_0_0/0.2)] transition-[translate,width] ease-cubic-out data-[state=unchecked]:translate-x-0 motion-reduce:transition-none dark:bg-gray-12',
          variant === 'square' ? 'rounded-sm' : 'rounded-full',
          THUMB_SIZE_CLASSES[size],
        )}
      >
        {icon && (
          <span className="flex items-center justify-center">{icon}</span>
        )}
      </SwitchPrimitive.Thumb>
    </SwitchPrimitive.Root>
  );
}

// Constants

const SIZE_CLASSES: Record<NonNullable<SwitchProps['size']>, string> = {
  sm: 'h-4 w-8',
  default: 'h-4 w-8',
  lg: 'h-5 w-10',
  xl: 'h-6 w-12',
};

const THUMB_SIZE_CLASSES: Record<NonNullable<SwitchProps['size']>, string> = {
  sm: 'h-3 w-3 data-[state=checked]:translate-x-4 group-[:hover:not(:disabled)]/switch:w-3.5 group-[:active:not(:disabled)]/switch:w-3.5 group-[:hover:not(:disabled)]/switch:data-[state=checked]:translate-x-3.5 group-[:active:not(:disabled)]/switch:data-[state=checked]:translate-x-3.5',
  default:
    'h-3 w-3 data-[state=checked]:translate-x-4 group-[:hover:not(:disabled)]/switch:w-3.5 group-[:active:not(:disabled)]/switch:w-3.5 group-[:hover:not(:disabled)]/switch:data-[state=checked]:translate-x-3.5 group-[:active:not(:disabled)]/switch:data-[state=checked]:translate-x-3.5',
  lg: 'h-4 w-4 data-[state=checked]:translate-x-5 group-[:hover:not(:disabled)]/switch:w-4.5 group-[:active:not(:disabled)]/switch:w-4.5 group-[:hover:not(:disabled)]/switch:data-[state=checked]:translate-x-4.5 group-[:active:not(:disabled)]/switch:data-[state=checked]:translate-x-4.5',
  xl: 'h-5 w-5 data-[state=checked]:translate-x-6 group-[:hover:not(:disabled)]/switch:w-5.5 group-[:active:not(:disabled)]/switch:w-5.5 group-[:hover:not(:disabled)]/switch:data-[state=checked]:translate-x-5.5 group-[:active:not(:disabled)]/switch:data-[state=checked]:translate-x-5.5',
};

const COLOR_CLASSES: Record<NonNullable<SwitchProps['color']>, string> = {
  default: 'data-[state=checked]:bg-success-9',
  secondary: 'data-[state=checked]:bg-gray-12',
};

const UNCHECKED_CLASSES =
  'data-[state=unchecked]:bg-gray-8 dark:data-[state=unchecked]:bg-gray-1 dark:data-[state=unchecked]:inset-ring dark:data-[state=unchecked]:inset-ring-gray-7';

const INDETERMINATE_CLASSES =
  'justify-center data-[state=unchecked]:bg-accent-5 data-[state=unchecked]:inset-ring-2 data-[state=unchecked]:inset-ring-accent-8';

// Helper functions

function handleCheckedChange(
  checked: boolean,
  isControlled: boolean,
  setInternalChecked: React.Dispatch<React.SetStateAction<boolean>>,
  onCheckedChange?: (checked: boolean) => void,
) {
  if (!isControlled) {
    setInternalChecked(checked);
  }
  if (onCheckedChange) {
    onCheckedChange(checked);
  }
}

// Type definitions

type SwitchProps = React.ComponentProps<typeof SwitchPrimitive.Root> & {
  checkedIcon?: React.ReactNode;
  uncheckedIcon?: React.ReactNode;
  variant?: 'default' | 'square';
  size?: 'default' | 'sm' | 'lg' | 'xl';
  color?: 'default' | 'secondary';
  indeterminate?: boolean;
};

export { Switch };
export type { SwitchProps };
