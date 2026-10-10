import { clsx, type ClassValue } from 'clsx';
import type { CSSProperties } from 'react';
import { extendTailwindMerge } from 'tailwind-merge';

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['xss', 'xsm'] }],
      shadow: [
        {
          shadow: [
            'ring',
            'float',
            'dialog',
            'toast',
            'drawer',
            'edge',
            'panel',
            'rest',
            'lift',
            'over',
            'glow-primary',
            'step-container',
            'add-button',
          ],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const GAP_SIZE_FOR_STEP_SETTINGS = 'gap-3';
export const DASHBOARD_CONTENT_PADDING_X =
  'px-[var(--dashboard-gutter-x,1rem)]';
export const DASHBOARD_PAGE_CONTAINER_CLASS =
  'mx-auto flex w-full max-w-320 flex-col px-4 md:px-12';
export const DASHBOARD_PAGE_CONTAINER_STYLE: DashboardGutterStyle = {
  '--dashboard-gutter-x': '0px',
};

type DashboardGutterStyle = CSSProperties & {
  '--dashboard-gutter-x': string;
};
