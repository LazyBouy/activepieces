import { describe, expect, it } from 'vitest';

import { shortcutUtils } from '@/components/custom/shortcut';

describe('shortcutUtils.getKeyLabels', () => {
  it('shows one label per key with platform modifiers', () => {
    expect(
      shortcutUtils.getKeyLabels({
        shortcutKey: 'k',
        withCtrl: true,
        isMac: false,
      }),
    ).toEqual(['Ctrl', 'K']);
    expect(
      shortcutUtils.getKeyLabels({
        shortcutKey: 'k',
        withCtrl: true,
        isMac: true,
      }),
    ).toEqual(['⌘', 'K']);
  });

  it('uses the shift glyph and the platform name for alt', () => {
    expect(
      shortcutUtils.getKeyLabels({
        shortcutKey: 't',
        withShift: true,
        withAlt: true,
        isMac: false,
      }),
    ).toEqual(['⇧', 'Alt', 'T']);
    expect(
      shortcutUtils.getKeyLabels({
        shortcutKey: 't',
        withShift: true,
        withAlt: true,
        isMac: true,
      }),
    ).toEqual(['⇧', '⌥', 'T']);
  });

  it('draws the minus key as a minus sign and keeps symbols as they are', () => {
    expect(
      shortcutUtils.getKeyLabels({ shortcutKey: '-', isMac: false }),
    ).toEqual(['−']);
    expect(
      shortcutUtils.getKeyLabels({ shortcutKey: '+', isMac: false }),
    ).toEqual(['+']);
    expect(
      shortcutUtils.getKeyLabels({ shortcutKey: '1', isMac: false }),
    ).toEqual(['1']);
  });

  it('shortens escape and title-cases named keys', () => {
    expect(
      shortcutUtils.getKeyLabels({
        shortcutKey: 'Esc',
        withCtrl: true,
        isMac: false,
      }),
    ).toEqual(['Esc']);
    expect(
      shortcutUtils.getKeyLabels({ shortcutKey: 'delete', isMac: false }),
    ).toEqual(['Delete']);
  });
});
