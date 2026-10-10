/**
 * @vitest-environment jsdom
 */
/* eslint-disable testing-library/no-unnecessary-act */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  SegmentedControl,
  type SegmentedControlProps,
} from '@/components/ui/segmented-control';
import { tabsListVariants, tabsTriggerVariants } from '@/components/ui/tabs';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function render(props: Partial<SegmentedControlProps>) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(
      <SegmentedControl
        aria-label="View"
        items={ITEMS}
        value="schema"
        {...props}
      />,
    );
  });
  return {
    group: container.querySelector('[role="radiogroup"]'),
    segments: Array.from(container.querySelectorAll('[role="radio"]')),
  };
}

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

describe('SegmentedControl', () => {
  it('renders one radio per item inside a labelled radio group', () => {
    const { group, segments } = render({});

    expect(group?.getAttribute('aria-label')).toBe('View');
    expect(segments.map((segment) => segment.textContent)).toEqual([
      'Schema',
      'Table',
      'JSON',
    ]);
  });

  it('marks only the current value as checked', () => {
    const { segments } = render({ value: 'table' });

    expect(segments.map((segment) => segment.getAttribute('aria-checked'))).toEqual(
      ['false', 'true', 'false'],
    );
    expect(segments[1].getAttribute('data-state')).toBe('checked');
  });

  it('reports the picked value when another segment is clicked', () => {
    const onValueChange = vi.fn();
    const { segments } = render({ onValueChange });

    act(() => {
      (segments[2] as HTMLButtonElement).click();
    });

    expect(onValueChange).toHaveBeenCalledWith('json');
  });

  it('does not let a disabled segment be picked', () => {
    const onValueChange = vi.fn();
    const { segments } = render({
      onValueChange,
      items: [...ITEMS.slice(0, 2), { ...ITEMS[2], disabled: true }],
    });

    expect((segments[2] as HTMLButtonElement).disabled).toBe(true);
    act(() => {
      (segments[2] as HTMLButtonElement).click();
    });
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('keeps an accessible name on icon-only segments', () => {
    const { segments } = render({
      items: [
        {
          value: 'schema',
          label: 'Schema',
          icon: <svg data-testid="icon" />,
          iconOnly: true,
        },
        ITEMS[1],
      ],
    });

    const label = segments[0].querySelector('.sr-only');
    expect(label?.textContent).toBe('Schema');
    expect(segments[0].className).toContain('aspect-square');
  });

  it('draws the 32px track by default and the 24px track at xs', () => {
    expect(render({}).group?.className).toContain('h-8');
    act(() => {
      root.unmount();
    });
    container.remove();

    const { group, segments } = render({ size: 'xs' });
    expect(group?.className).toContain('h-6');
    expect(segments[0].className).toContain('text-xss');
  });
});

describe('Tabs default variant', () => {
  it('uses the segmented track and segment look', () => {
    expect(tabsListVariants()).toContain('h-8');
    expect(tabsListVariants()).toContain('bg-gray-5');
    expect(tabsTriggerVariants()).toContain('text-xs');
    expect(tabsTriggerVariants()).toContain('data-[state=active]:bg-panel');
  });
});

const ITEMS = [
  { value: 'schema', label: 'Schema' },
  { value: 'table', label: 'Table' },
  { value: 'json', label: 'JSON' },
];
