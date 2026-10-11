import { isNil } from '@activepieces/core-utils';
import { t } from 'i18next';
import { Paperclip } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

import { SelectUtilButton } from '../custom/select-util-button';

export const inputClass =
  'flex h-9 w-full min-w-0 rounded-md border border-gray-6 bg-panel px-3 py-1 text-base text-gray-12 transition-[color,border-color] ease-cubic-in-out outline-hidden selection:bg-accent-9 selection:text-on-accent file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-gray-12 placeholder:text-gray-11 [&:hover:not(:focus-within,:disabled,[aria-invalid=true])]:border-gray-7 focus-visible:border-focus focus-visible:ring-2 focus-visible:ring-focus-halo disabled:cursor-not-allowed disabled:opacity-60 md:text-sm dark:bg-gray-1 aria-invalid:border-danger-9 aria-invalid:focus-visible:ring-danger-9/20';

function Input({
  className,
  type,
  thin = false,
  defaultFileName,
  leadingIcon,
  trailingIcon,
  startAddon,
  endAddon,
  ref,
  ...props
}: InputProps) {
  const [fileName, setFileName] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useImperativeHandle(ref, () => inputRef.current!);

  const hasAffixes =
    !isNil(leadingIcon) ||
    !isNil(trailingIcon) ||
    !isNil(startAddon) ||
    !isNil(endAddon);

  if (type !== 'file' && hasAffixes) {
    return (
      <div
        data-slot="input-group"
        className={cn(
          inputClass,
          'items-center overflow-hidden px-0 py-0 focus-within:border-focus focus-within:ring-2 focus-within:ring-focus-halo has-[input:disabled]:cursor-not-allowed has-[input:disabled]:opacity-60 has-[input[aria-invalid=true]]:border-danger-9',
          { 'h-7 text-xsm md:text-xsm': thin },
          className,
        )}
        onPointerDown={(event) => {
          if (event.target !== inputRef.current && !isInteractive(event)) {
            event.preventDefault();
            inputRef.current?.focus();
          }
        }}
      >
        {!isNil(startAddon) && (
          <span
            data-slot="input-addon"
            className={cn(ADDON_CLASS_NAME, 'border-r', { 'px-2': thin })}
          >
            {startAddon}
          </span>
        )}
        <span
          className={cn(
            'flex h-full min-w-0 flex-1 items-center gap-1.5 px-3',
            {
              'px-2': thin,
            },
          )}
        >
          {!isNil(leadingIcon) && (
            <span data-slot="input-icon" className={ICON_CLASS_NAME}>
              {leadingIcon}
            </span>
          )}
          <input
            type={type}
            data-slot="input"
            className="h-full w-full min-w-0 bg-transparent outline-hidden selection:bg-accent-9 selection:text-on-accent placeholder:text-gray-11 disabled:cursor-not-allowed"
            ref={inputRef}
            {...props}
          />
          {!isNil(trailingIcon) && (
            <span data-slot="input-icon" className={ICON_CLASS_NAME}>
              {trailingIcon}
            </span>
          )}
        </span>
        {!isNil(endAddon) && (
          <span
            data-slot="input-addon"
            className={cn(ADDON_CLASS_NAME, 'border-l', { 'px-2': thin })}
          >
            {endAddon}
          </span>
        )}
      </div>
    );
  }

  return type === 'file' ? (
    <>
      <input
        type="file"
        className="hidden"
        ref={inputRef}
        {...props}
        onChange={(event) =>
          handleFileChange(event, setFileName, props.onChange)
        }
      />
      <div
        onClick={() => inputRef.current?.click()}
        className={cn(
          inputClass,
          'cursor-pointer items-center focus-within:border-focus focus-within:ring-2 focus-within:ring-focus-halo',
          className,
        )}
      >
        <input
          data-slot="input"
          aria-label={t('Select a file')}
          className={cn('grow cursor-pointer outline-hidden bg-transparent', {
            'text-gray-11': !fileName,
          })}
          value={fileName || defaultFileName || t('Select a file')}
          readOnly
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
        />
        <div className="basis-1">
          <SelectUtilButton
            onClick={(e) => e.preventDefault()}
            tooltipText={fileName ? fileName : t('Select a file')}
            Icon={Paperclip}
          ></SelectUtilButton>
        </div>
      </div>
    </>
  ) : (
    <input
      type={type}
      data-slot="input"
      className={cn(inputClass, className, {
        'h-7 px-2 text-xsm md:text-xsm': thin,
      })}
      ref={inputRef}
      {...props}
    />
  );
}

function isInteractive(event: React.PointerEvent<HTMLDivElement>): boolean {
  return (
    event.target instanceof Element &&
    event.target.closest('button, a, input, [role="button"]') !== null
  );
}

// Helper functions

function handleFileChange(
  event: React.ChangeEvent<HTMLInputElement>,
  setFileName: React.Dispatch<React.SetStateAction<string | null>>,
  onChange?: React.ChangeEventHandler<HTMLInputElement>,
) {
  const file = event.target.files?.[0];
  setFileName(file ? file.name : null);
  onChange?.(event);
}

// Type definitions

const ADDON_CLASS_NAME =
  'flex h-full shrink-0 items-center border-gray-6 bg-gray-4 px-3 whitespace-nowrap text-gray-12/87';
const ICON_CLASS_NAME =
  "flex shrink-0 items-center text-gray-12 opacity-70 [&_svg:not([class*='size-'])]:size-4";

type InputProps = React.ComponentProps<'input'> & {
  thin?: boolean;
  defaultFileName?: string;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  startAddon?: React.ReactNode;
  endAddon?: React.ReactNode;
};

export { Input };
export type { InputProps };
