/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/route-utils', () => ({
  routesThatRequireProjectId: {
    singleAgent: '/agents/:agentId',
    singleAgentRuns: '/agents/:agentId/runs',
  },
}));

vi.setConfig({ testTimeout: 20000 });

type RailModule = typeof import('@/features/workspace/lib/rail-collapsed');

async function loadWithStorage(storage: StorageSetup): Promise<RailModule> {
  vi.resetModules();
  storage();
  return import('@/features/workspace/lib/rail-collapsed');
}

function memoryStorage(initial: Record<string, string> = {}): StorageSetup {
  return () => {
    Object.entries(initial).forEach(([key, value]) =>
      window.localStorage.setItem(key, value),
    );
  };
}

function throwingStorage(): StorageSetup {
  return () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
  };
}

function shortcutEvent(
  overrides: Partial<ShortcutEventInput> = {},
): ShortcutEventInput {
  return {
    key: '[',
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    defaultPrevented: false,
    target: null,
    dialogOpen: false,
    ...overrides,
  };
}

function target({
  tagName = 'DIV',
  isContentEditable = false,
  insideEditor = false,
}: {
  tagName?: string;
  isContentEditable?: boolean;
  insideEditor?: boolean;
}) {
  return {
    tagName,
    isContentEditable,
    closest: () => (insideEditor ? {} : null),
  };
}

describe('rail-collapsed', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  describe('when storage throws', () => {
    it('falls back to an expanded rail at the default width', async () => {
      const { useRailCollapsed, railSizing } = await loadWithStorage(
        throwingStorage(),
      );

      expect(useRailCollapsed.getState().preference).toBe(false);
      expect(useRailCollapsed.getState().width).toBe(railSizing.defaultWidth);
    });

    it('still collapses, expands and resizes in memory', async () => {
      const { useRailCollapsed } = await loadWithStorage(throwingStorage());

      useRailCollapsed.getState().setCollapsed(true);
      expect(useRailCollapsed.getState().preference).toBe(true);

      useRailCollapsed.getState().toggle();
      expect(useRailCollapsed.getState().preference).toBe(false);

      useRailCollapsed.getState().setWidth(320);
      expect(() => useRailCollapsed.getState().saveWidth()).not.toThrow();
      expect(useRailCollapsed.getState().width).toBe(320);
    });

    it('reads the project section and sort preferences as defaults', async () => {
      const { railPreferences } = await loadWithStorage(throwingStorage());

      expect(railPreferences.readProjectsCollapsed()).toBe(false);
      expect(railPreferences.readPinnedSort()).toBeNull();
      expect(() => railPreferences.writeProjectsCollapsed(true)).not.toThrow();
      expect(() => railPreferences.writePinnedSort('recency')).not.toThrow();
    });
  });

  describe('when storage is available', () => {
    it('restores the collapsed flag and width saved earlier', async () => {
      const { useRailCollapsed } = await loadWithStorage(
        memoryStorage({
          'primary-rail-collapsed': 'true',
          'primary-rail-width': '312',
        }),
      );

      expect(useRailCollapsed.getState().preference).toBe(true);
      expect(useRailCollapsed.getState().width).toBe(312);
    });

    it('persists the collapsed flag at once and the width only on save', async () => {
      const { useRailCollapsed } = await loadWithStorage(memoryStorage());

      useRailCollapsed.getState().setCollapsed(true);
      expect(window.localStorage.getItem('primary-rail-collapsed')).toBe(
        'true',
      );

      useRailCollapsed.getState().setWidth(264);
      expect(window.localStorage.getItem('primary-rail-width')).toBeNull();

      useRailCollapsed.getState().saveWidth();
      expect(window.localStorage.getItem('primary-rail-width')).toBe('264');
    });

    it.each([
      ['1000', 500],
      ['12', 200],
      ['not-a-number', 200],
      ['-40', 200],
    ])('clamps a stored width of %s to %i', async (stored, expected) => {
      const { useRailCollapsed } = await loadWithStorage(
        memoryStorage({ 'primary-rail-width': stored }),
      );

      expect(useRailCollapsed.getState().width).toBe(expected);
    });
  });

  describe('railSizing', () => {
    it('snaps to 8px steps inside 200-500', async () => {
      const { railSizing } = await loadWithStorage(memoryStorage());

      expect(railSizing.snapWidth(263)).toBe(264);
      expect(railSizing.snapWidth(259)).toBe(256);
      expect(railSizing.snapWidth(120)).toBe(200);
      expect(railSizing.snapWidth(498)).toBe(496);
      expect(railSizing.snapWidth(502)).toBe(500);
      expect(railSizing.snapWidth(900)).toBe(500);
    });

    it('collapses while the pointer is left of 100px and resizes otherwise', async () => {
      const { railSizing } = await loadWithStorage(memoryStorage());

      expect(railSizing.resolveDrag({ pointerX: 99, railLeft: 0 })).toEqual({
        collapsed: true,
        width: null,
      });
      expect(railSizing.resolveDrag({ pointerX: 100, railLeft: 0 })).toEqual({
        collapsed: false,
        width: 200,
      });
      expect(railSizing.resolveDrag({ pointerX: 333, railLeft: 0 })).toEqual({
        collapsed: false,
        width: 336,
      });
      expect(railSizing.resolveDrag({ pointerX: 1400, railLeft: 0 })).toEqual({
        collapsed: false,
        width: 500,
      });
    });

    it('picks the resize cursor from the width limits', async () => {
      const { railSizing } = await loadWithStorage(memoryStorage());

      expect(railSizing.resizeCursor({ collapsed: true, width: 300 })).toBe(
        'e-resize',
      );
      expect(railSizing.resizeCursor({ collapsed: false, width: 200 })).toBe(
        'e-resize',
      );
      expect(railSizing.resizeCursor({ collapsed: false, width: 500 })).toBe(
        'w-resize',
      );
      expect(railSizing.resizeCursor({ collapsed: false, width: 320 })).toBe(
        'col-resize',
      );
    });
  });

  describe('railShortcut', () => {
    it('toggles on a bare [ outside editable fields', async () => {
      const { railShortcut } = await loadWithStorage(memoryStorage());

      expect(railShortcut.isToggleShortcut(shortcutEvent())).toBe(true);
      expect(
        railShortcut.isToggleShortcut(shortcutEvent({ target: target({}) })),
      ).toBe(true);
    });

    it.each([
      ['another key', { key: ']' }],
      ['ctrl held', { ctrlKey: true }],
      ['meta held', { metaKey: true }],
      ['alt held', { altKey: true }],
      ['already handled', { defaultPrevented: true }],
      ['a dialog is open', { dialogOpen: true }],
    ])('ignores the key when %s', async (_label, overrides) => {
      const { railShortcut } = await loadWithStorage(memoryStorage());

      expect(railShortcut.isToggleShortcut(shortcutEvent(overrides))).toBe(
        false,
      );
    });

    it.each([
      ['an input', target({ tagName: 'INPUT' })],
      ['a textarea', target({ tagName: 'TEXTAREA' })],
      ['a select', target({ tagName: 'SELECT' })],
      ['a content-editable element', target({ isContentEditable: true })],
      ['a code editor', target({ insideEditor: true })],
    ])('ignores the key when focus is in %s', async (_label, focused) => {
      const { railShortcut } = await loadWithStorage(memoryStorage());

      expect(
        railShortcut.isToggleShortcut(shortcutEvent({ target: focused })),
      ).toBe(false);
    });
  });
});

type StorageSetup = () => void;

type ShortcutEventInput = Parameters<
  RailModule['railShortcut']['isToggleShortcut']
>[0];
