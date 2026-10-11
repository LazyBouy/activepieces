// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { Search } from 'lucide-react';
import { createRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { Input } from '@/components/ui/input';

afterEach(() => {
  cleanup();
});

describe('Input', () => {
  it('renders a bare input when no affixes are given', () => {
    const { container } = render(<Input className="h-10" placeholder="Name" />);

    const input = container.firstElementChild;
    expect(input?.tagName).toBe('INPUT');
    expect(input?.className).toContain('h-10');
    expect(container.querySelector('[data-slot="input-group"]')).toBeNull();
  });

  it('draws the field frame around the leading icon and the input', () => {
    const { container } = render(
      <Input leadingIcon={<Search />} placeholder="Search" />,
    );

    const group = container.querySelector('[data-slot="input-group"]');
    const icon = container.querySelector('[data-slot="input-icon"]');
    const input = container.querySelector('input');
    expect(group?.className).toContain('border-gray-6');
    expect(group?.className).toContain('focus-within:border-focus');
    expect(icon?.className).toContain('opacity-70');
    expect(input?.className).not.toContain('border');
    expect(input?.getAttribute('placeholder')).toBe('Search');
  });

  it('glues text add-ons to either end with a divider', () => {
    const { container } = render(
      <Input startAddon="https://" endAddon=".com" />,
    );

    const addons = container.querySelectorAll('[data-slot="input-addon"]');
    expect([...addons].map((addon) => addon.textContent)).toEqual([
      'https://',
      '.com',
    ]);
    expect(addons[0].className).toContain('bg-gray-4');
    expect(addons[0].className).toContain('border-r');
    expect(addons[1].className).toContain('border-l');
  });

  it('passes value, events and the ref through to the inner input', () => {
    const ref = createRef<HTMLInputElement>();
    const values: string[] = [];
    const { container } = render(
      <Input
        ref={ref}
        trailingIcon={<Search />}
        onChange={(event) => values.push(event.target.value)}
      />,
    );

    const input = container.querySelector('input');
    if (!input) {
      throw new Error('input not rendered');
    }
    fireEvent.change(input, { target: { value: 'flows' } });
    expect(values).toEqual(['flows']);
    expect(ref.current).toBe(input);
  });
});
