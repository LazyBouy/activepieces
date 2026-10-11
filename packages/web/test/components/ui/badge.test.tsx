// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { Check } from 'lucide-react';
import { afterEach, describe, expect, it } from 'vitest';

import { Badge } from '@/components/ui/badge';

afterEach(() => {
  cleanup();
});

describe('Badge', () => {
  it('puts a text label in a truncating span so long labels end in an ellipsis', () => {
    const { container } = render(
      <Badge>A very long label that does not fit</Badge>,
    );

    const label = container.querySelector('[data-slot="badge-label"]');
    expect(label?.textContent).toBe('A very long label that does not fit');
    expect(label?.className).toContain('truncate');
    expect(label?.className).toContain('min-w-0');
  });

  it('joins adjacent text into one label next to an icon', () => {
    const count = 3;
    const { container } = render(
      <Badge>
        <Check />
        Passed {count} times
      </Badge>,
    );

    const badge = container.querySelector('[data-slot="badge"]');
    const labels = container.querySelectorAll('[data-slot="badge-label"]');
    expect(badge?.firstElementChild?.tagName.toLowerCase()).toBe('svg');
    expect([...labels].map((label) => label.textContent)).toEqual([
      'Passed 3 times',
    ]);
  });

  it('leaves element children and asChild content untouched', () => {
    const { container } = render(
      <>
        <Badge>
          <span className="truncate">custom</span>
        </Badge>
        <Badge asChild>
          <a href="#runs">Runs</a>
        </Badge>
      </>,
    );

    expect(
      container.querySelectorAll('[data-slot="badge-label"]'),
    ).toHaveLength(0);
    expect(container.querySelector('a')?.getAttribute('data-slot')).toBe(
      'badge',
    );
  });
});
