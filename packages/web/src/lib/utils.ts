import { clsx, type ClassValue } from 'clsx';
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
export const DASHBOARD_CONTENT_PADDING_X = 'px-4';
