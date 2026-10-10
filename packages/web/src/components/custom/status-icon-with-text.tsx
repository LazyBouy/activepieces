import { CircleCheck } from 'lucide-react';
import React from 'react';

import { cn } from '@/lib/utils';

const variantIconClassName: Record<StatusVariant, string> = {
  success: 'fill-success-9 text-success-9 [&>path]:stroke-on-success',
  warning: 'text-warning-9',
  error: 'text-danger-9',
  primary: 'text-accent-9',
  neutral: 'text-gray-10',
  default: 'text-gray-10',
  secondary: 'text-gray-10',
};

const StatusIconWithText = React.memo(
  ({
    icon: Icon,
    text,
    variant = 'default',
    spin = false,
  }: StatusIconWithTextProps) => {
    const StatusIcon = variant === 'success' ? CircleCheck : Icon;
    return (
      <span
        data-slot="status-icon-with-text"
        data-variant={variant}
        className="inline-flex max-w-full min-w-0 items-center gap-2 text-sm text-gray-12"
      >
        <StatusIcon
          className={cn(
            'size-4 shrink-0',
            variantIconClassName[variant],
            spin && 'animate-spin',
          )}
        />
        <span className="truncate">{text}</span>
      </span>
    );
  },
);

StatusIconWithText.displayName = 'StatusIconWithText';
export { StatusIconWithText };

export type StatusVariant =
  | 'default'
  | 'neutral'
  | 'primary'
  | 'success'
  | 'warning'
  | 'error'
  | 'secondary';

interface StatusIconWithTextProps {
  icon: React.ElementType;
  text: string;
  variant?: StatusVariant;
  spin?: boolean;
}
