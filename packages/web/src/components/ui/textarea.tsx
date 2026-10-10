import * as React from 'react';
import TextareaAutosize from 'react-textarea-autosize';

import { cn } from '@/lib/utils';

function Textarea({ className, ...props }: ResizableTextareaProps) {
  return (
    <TextareaAutosize
      data-slot="textarea"
      cacheMeasurements={false}
      minRows={1}
      maxRows={5}
      className={cn(
        'flex w-full resize-y rounded-md border border-gray-6 bg-panel p-3 text-sm leading-tight text-gray-12 transition-[color,border-color] ease-cubic-in-out outline-hidden placeholder:text-gray-11 [&:hover:not(:focus-within,:disabled,[aria-invalid=true])]:border-gray-7 focus-visible:border-focus focus-visible:ring-2 focus-visible:ring-focus-halo disabled:cursor-not-allowed disabled:opacity-60 dark:bg-gray-1 aria-invalid:border-danger-9 aria-invalid:focus-visible:ring-danger-9/20',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;
type Style = Omit<
  NonNullable<TextareaProps['style']>,
  'maxHeight' | 'minHeight'
> & {
  height?: number;
};
type TextareaHeightChangeMeta = {
  rowHeight: number;
};
interface TextareaAutosizeProps extends Omit<TextareaProps, 'style'> {
  maxRows?: number;
  minRows?: number;
  onHeightChange?: (height: number, meta: TextareaHeightChangeMeta) => void;
  cacheMeasurements?: boolean;
  style?: Style;
}

export type ResizableTextareaProps = TextareaAutosizeProps &
  React.RefAttributes<HTMLTextAreaElement>;
