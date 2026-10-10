'use client';

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { Toaster as Sonner, toast, type ToasterProps } from 'sonner';

import { useTheme } from '@/components/providers/theme-provider';

export const INTERNAL_ERROR_MESSAGE =
  'An unexpected error occurred. Please try again in a moment.';

export function internalErrorToast() {
  console.error('internalErrorToast', INTERNAL_ERROR_MESSAGE);
  toast.error('Something went wrong', {
    description: INTERNAL_ERROR_MESSAGE,
    duration: 3000,
  });
}

export const UNSAVED_CHANGES_TOAST = {
  id: 'unsaved-changes',
  title: 'Unsaved Changes',
  description:
    'Something went wrong and there are unsaved changes, please refresh and contact support if the problem persists.',
  variant: 'destructive',
  duration: Infinity,
};

function Toaster({ ...props }: ToasterProps) {
  const { resolvedTheme } = useTheme();

  return (
    <Sonner
      theme={resolvedTheme}
      className="group"
      expand={true}
      offset={16}
      toastOptions={{
        classNames: {
          toast:
            'gap-3.25! pt-3.5! pr-6.5! pb-3.5! pl-3.25! text-gray-12! shadow-toast!',
          title: 'text-base! font-semibold! text-gray-12!',
          description: 'text-sm! leading-normal! text-gray-12!',
          icon: 'm-0! size-6!',
          closeButton:
            'top-4.5! right-3.75! left-auto! size-5! transform-none! border-0! bg-transparent! text-gray-11! hover:text-gray-12!',
        },
      }}
      icons={{
        success: <CircleCheckIcon className="size-6 text-success-9" />,
        info: <InfoIcon className="size-6 text-gray-11" />,
        warning: <TriangleAlertIcon className="size-6 text-warning-10" />,
        error: <OctagonXIcon className="size-6 text-danger-9" />,
        loading: <Loader2Icon className="size-6 animate-spin text-gray-11" />,
      }}
      style={
        {
          '--normal-text': 'var(--gray-12)',
          '--normal-bg': 'var(--panel)',
          '--normal-border': 'var(--gray-4)',
          '--border-radius': 'var(--radius)',
          '--width': '330px',
          zIndex: 60,
        } as React.CSSProperties
      }
      {...props}
    />
  );
}

export { Toaster };
