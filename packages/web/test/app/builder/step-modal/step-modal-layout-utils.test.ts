// @vitest-environment jsdom
import { FlowActionType } from '@activepieces/shared';
import { describe, expect, it, vi } from 'vitest';

import {
  LayoutStorage,
  stepModalLayoutUtils,
} from '@/app/builder/step-modal/step-modal-layout-utils';

import { code, pieceTrigger } from '../state/builder-store-fixtures';

describe('stepModalLayoutUtils.getLayoutClass', () => {
  it('uses the wide layout for code steps and no input column for triggers', () => {
    expect(stepModalLayoutUtils.getLayoutClass(code({ name: 'step_1' }))).toBe(
      'wide',
    );
    expect(stepModalLayoutUtils.getLayoutClass(pieceTrigger())).toBe(
      'inputless',
    );
  });

  it('keys the saved layout by piece name or by step type', () => {
    expect(stepModalLayoutUtils.getStorageKey(pieceTrigger())).toBe(
      'ap.stepModal.layout.@activepieces/piece-webhook.trigger',
    );
    expect(stepModalLayoutUtils.getStorageKey(code({ name: 'step_1' }))).toBe(
      `ap.stepModal.layout.${FlowActionType.CODE}`,
    );
  });
});

describe('stepModalLayoutUtils widths', () => {
  it('fills the frame exactly with the default centre width', () => {
    const widths = stepModalLayoutUtils.getDefaultWidths({
      total: 1391,
      layoutClass: 'regular',
    });
    expect(widths.center).toBe(420);
    expect(widths.input + widths.center + widths.output).toBe(1391);
    expect(Math.abs(widths.input - widths.output)).toBeLessThanOrEqual(1);
  });

  it('gives the inputless layout no input column', () => {
    const widths = stepModalLayoutUtils.getDefaultWidths({
      total: 1000,
      layoutClass: 'inputless',
    });
    expect(widths).toEqual({ input: 0, center: 480, output: 520 });
  });

  it('resizes in 8px steps and stops at the minimums', () => {
    const start = { input: 400, center: 420, output: 400 };
    const right = stepModalLayoutUtils.resizeEdge({
      start,
      edge: 'right',
      delta: 13,
      layoutClass: 'regular',
    });
    expect(right).toEqual({ input: 400, center: 436, output: 384 });

    const squeezed = stepModalLayoutUtils.resizeEdge({
      start,
      edge: 'left',
      delta: 500,
      layoutClass: 'regular',
    });
    expect(squeezed.center).toBe(stepModalLayoutUtils.LAYOUT.centerMin);
    expect(squeezed.input + squeezed.center).toBe(820);

    const collapsedOutput = stepModalLayoutUtils.resizeEdge({
      start,
      edge: 'right',
      delta: 1000,
      layoutClass: 'regular',
    });
    expect(collapsedOutput.output).toBe(stepModalLayoutUtils.LAYOUT.sideMin);
  });

  it('moves the centre column at a constant width with the grip', () => {
    const moved = stepModalLayoutUtils.moveCenter({
      start: { input: 400, center: 420, output: 400 },
      delta: -64,
      layoutClass: 'regular',
    });
    expect(moved).toEqual({ input: 336, center: 420, output: 464 });
  });

  it('restores saved percentages clamped to the minimums', () => {
    const widths = stepModalLayoutUtils.fromPercentages({
      percentages: { input: 2, center: 20, output: 78 },
      total: 1000,
      layoutClass: 'regular',
    });
    expect(widths.center).toBe(stepModalLayoutUtils.LAYOUT.centerMin);
    expect(widths.input).toBe(stepModalLayoutUtils.LAYOUT.sideMin);
    expect(widths.input + widths.center + widths.output).toBe(1000);
  });
});

describe('stepModalLayoutUtils persistence', () => {
  it('round-trips the layout through storage', () => {
    const storage = createMemoryStorage();
    stepModalLayoutUtils.saveLayout({
      key: 'k',
      percentages: { input: 30, center: 40, output: 30 },
      storage,
    });
    expect(stepModalLayoutUtils.readLayout({ key: 'k', storage })).toEqual({
      input: 30,
      center: 40,
      output: 30,
    });
    stepModalLayoutUtils.clearLayout({ key: 'k', storage });
    expect(stepModalLayoutUtils.readLayout({ key: 'k', storage })).toBeNull();
  });

  it('falls back to defaults when storage throws', () => {
    const throwingStorage: LayoutStorage = {
      getItem: vi.fn(() => {
        throw new Error('blocked');
      }),
      setItem: vi.fn(() => {
        throw new Error('blocked');
      }),
      removeItem: vi.fn(() => {
        throw new Error('blocked');
      }),
    };
    expect(
      stepModalLayoutUtils.readLayout({ key: 'k', storage: throwingStorage }),
    ).toBeNull();
    expect(() =>
      stepModalLayoutUtils.saveLayout({
        key: 'k',
        percentages: { input: 30, center: 40, output: 30 },
        storage: throwingStorage,
      }),
    ).not.toThrow();
    expect(() =>
      stepModalLayoutUtils.clearLayout({ key: 'k', storage: throwingStorage }),
    ).not.toThrow();
  });

  it('ignores corrupted saved values', () => {
    const storage = createMemoryStorage();
    storage.setItem('bad-json', '{not json');
    storage.setItem(
      'bad-sum',
      JSON.stringify({ input: 10, center: 10, output: 10 }),
    );
    expect(
      stepModalLayoutUtils.readLayout({ key: 'bad-json', storage }),
    ).toBeNull();
    expect(
      stepModalLayoutUtils.readLayout({ key: 'bad-sum', storage }),
    ).toBeNull();
  });
});

function createMemoryStorage(): LayoutStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
}
