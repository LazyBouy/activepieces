// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

afterEach(() => {
  cleanup();
});

describe('TabsTrigger unread dot', () => {
  it('draws a 5px orange dot after the label only when unread', () => {
    const { getByRole } = render(
      <Tabs defaultValue="runs">
        <TabsList variant="outline">
          <TabsTrigger value="runs" variant="outline" unread>
            Runs
          </TabsTrigger>
          <TabsTrigger value="versions" variant="outline">
            Versions
          </TabsTrigger>
        </TabsList>
      </Tabs>,
    );

    const runs = getByRole('tab', { name: 'Runs' });
    const versions = getByRole('tab', { name: 'Versions' });
    const dot = runs.querySelector('[data-slot="tabs-unread-dot"]');
    expect(runs.getAttribute('data-unread')).toBe('true');
    expect(runs.lastElementChild).toBe(dot);
    expect(dot?.className).toContain('size-1.25');
    expect(dot?.className).toContain('bg-accent-9');
    expect(dot?.getAttribute('aria-hidden')).toBe('true');
    expect(versions.hasAttribute('data-unread')).toBe(false);
    expect(versions.querySelector('[data-slot="tabs-unread-dot"]')).toBeNull();
  });
});
