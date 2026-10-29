import { isNil } from '@activepieces/core-utils';
import type React from 'react';

function handle({ event }: { event: React.KeyboardEvent<HTMLElement> }): void {
  const target = event.target;
  if (
    !TREE_KEYS.includes(event.key) ||
    !(target instanceof HTMLElement) ||
    !target.hasAttribute(FOCUS_ATTRIBUTE)
  ) {
    return;
  }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(`[${FOCUS_ATTRIBUTE}]`),
    );
    const next =
      items[
        nextRowIndex({
          count: items.length,
          currentIndex: items.indexOf(target),
          step: event.key === 'ArrowDown' ? 1 : -1,
        })
      ];
    if (isNil(next) || next === target) {
      return;
    }
    event.preventDefault();
    next.focus();
    return;
  }
  const row = target.closest<HTMLElement>('[data-tree-row]');
  const expanded = row?.getAttribute('data-tree-expanded');
  if (isNil(row) || isNil(expanded)) {
    return;
  }
  if ((expanded === 'true') === (event.key === 'ArrowRight')) {
    return;
  }
  event.preventDefault();
  row.querySelector<HTMLElement>('[data-tree-toggle]')?.click();
}

function nextRowIndex({
  count,
  currentIndex,
  step,
}: {
  count: number;
  currentIndex: number;
  step: 1 | -1;
}): number {
  if (count === 0 || currentIndex === -1) {
    return -1;
  }
  return Math.min(Math.max(currentIndex + step, 0), count - 1);
}

const TREE_KEYS = ['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft'];

const FOCUS_ATTRIBUTE = 'data-tree-focus';

export const inputTreeKeys = {
  handle,
  nextRowIndex,
};
