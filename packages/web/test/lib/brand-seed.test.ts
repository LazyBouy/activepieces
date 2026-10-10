/**
 * @vitest-environment jsdom
 */
import { brandColors } from '@activepieces/shared';
import { beforeEach, describe, expect, it } from 'vitest';

import { brandSeed } from '@/lib/brand-seed';

describe('brandSeed', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('style');
  });

  it('writes no colour variable, so the stylesheet palette is the only one', () => {
    brandSeed.clear();
    expect(document.documentElement.style.length).toBe(0);
  });

  it('removes colour variables an earlier seed left on the page', () => {
    const { style } = document.documentElement;
    style.setProperty('--accent-light-9', '#0ea5e9');
    style.setProperty('--danger-dark-3', '#3a0a0a');
    style.setProperty('--on-accent', '#000000');
    style.setProperty('--on-warning-seed', '#ffffff');
    brandSeed.clear();
    brandColors
      .variableNames()
      .forEach((name) => expect(style.getPropertyValue(name)).toBe(''));
    expect(style.length).toBe(0);
  });
});
