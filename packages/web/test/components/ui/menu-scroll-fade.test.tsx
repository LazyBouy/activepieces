// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { menuScrollFadeUtils } from '@/components/ui/menu-scroll-fade';

globalThis.ResizeObserver = class {
  observe() {
    return undefined;
  }
  unobserve() {
    return undefined;
  }
  disconnect() {
    return undefined;
  }
};

afterEach(() => {
  cleanup();
});

describe('menuScrollFadeUtils.hasHiddenItemsBelow', () => {
  it('is true while items are hidden below the visible area', () => {
    expect(
      menuScrollFadeUtils.hasHiddenItemsBelow({
        scrollHeight: 600,
        clientHeight: 300,
        scrollTop: 100,
      }),
    ).toBe(true);
  });

  it('is false at the end of the list or when nothing scrolls', () => {
    expect(
      menuScrollFadeUtils.hasHiddenItemsBelow({
        scrollHeight: 600,
        clientHeight: 300,
        scrollTop: 300,
      }),
    ).toBe(false);
    expect(
      menuScrollFadeUtils.hasHiddenItemsBelow({
        scrollHeight: 200,
        clientHeight: 200,
        scrollTop: 0,
      }),
    ).toBe(false);
  });
});

describe('DropdownMenuContent bottom fade', () => {
  it('shows the fade only while the panel can scroll further down', () => {
    render(
      <DropdownMenu open={true} modal={false}>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>First</DropdownMenuItem>
          <DropdownMenuItem>Second</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    const fade = document.querySelector('[data-slot="menu-scroll-fade"]');
    const panel = fade?.parentElement;
    if (!fade || !panel) {
      throw new Error('menu not rendered');
    }
    expect(panel.getAttribute('data-slot')).toBe('dropdown-menu-content');
    expect(fade.hasAttribute('data-visible')).toBe(false);

    Object.defineProperty(panel, 'scrollHeight', { value: 600 });
    Object.defineProperty(panel, 'clientHeight', { value: 300 });
    act(() => {
      panel.dispatchEvent(new Event('scroll'));
    });
    expect(fade.hasAttribute('data-visible')).toBe(true);

    act(() => {
      panel.scrollTop = 300;
      panel.dispatchEvent(new Event('scroll'));
    });
    expect(fade.hasAttribute('data-visible')).toBe(false);
  });
});
