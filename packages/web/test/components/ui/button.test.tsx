/**
 * @vitest-environment jsdom
 */
/* eslint-disable testing-library/no-unnecessary-act */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import { Button, type ButtonProps } from '@/components/ui/button';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function render(props: ButtonProps) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(<Button {...props}>Publish</Button>);
  });
  const button = container.querySelector('button');
  if (!button) {
    throw new Error('button not rendered');
  }
  return button;
}

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

describe('Button', () => {
  it('renders the solid and destructive variants as light islands', () => {
    expect(render({}).getAttribute('data-theme')).toBe('light');
    act(() => {
      root.unmount();
    });
    container.remove();
    expect(render({ variant: 'destructive' }).getAttribute('data-theme')).toBe(
      'light',
    );
    act(() => {
      root.unmount();
    });
    container.remove();
    expect(render({ variant: 'secondary' }).hasAttribute('data-theme')).toBe(
      false,
    );
  });

  it('is 32px tall with a 4px radius at the default size', () => {
    const button = render({});

    expect(button.className).toContain('h-8');
    expect(button.className).toContain('rounded-sm');
    expect(button.className).toContain('font-medium');
  });

  it('keeps the label in the layout while loading and shows a spinner', () => {
    const button = render({ loading: true });
    const label = button.querySelector('[data-slot="button-label"]');

    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(label?.textContent).toBe('Publish');
    expect(label?.getAttribute('aria-hidden')).toBe('true');
    expect(button.querySelector('[data-slot="button-spinner"] svg')).not.toBe(
      null,
    );
  });

  it('renders the label directly when not loading', () => {
    const button = render({ variant: 'ghost' });

    expect(button.querySelector('[data-slot="button-label"]')).toBe(null);
    expect(button.textContent).toBe('Publish');
  });
});
