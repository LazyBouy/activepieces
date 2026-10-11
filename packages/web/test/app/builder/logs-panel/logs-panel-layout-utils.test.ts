import { describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_LOGS_PANES,
  LOGS_PANEL_LAYOUT,
  LogsPanelStorage,
  logsPanelLayoutUtils,
} from '@/app/builder/logs-panel/logs-panel-layout-utils';

function memoryStorage(
  initial: Record<string, string> = {},
): LogsPanelStorage & { values: Record<string, string> } {
  const values = { ...initial };
  return {
    values,
    getItem: (key) => values[key] ?? null,
    setItem: (key, value) => {
      values[key] = value;
    },
  };
}

function throwingStorage(): LogsPanelStorage {
  return {
    getItem: vi.fn(() => {
      throw new Error('blocked');
    }),
    setItem: vi.fn(() => {
      throw new Error('quota');
    }),
  };
}

describe('logs panel height persistence', () => {
  it('round-trips the saved height under the documented key', () => {
    const storage = memoryStorage();
    logsPanelLayoutUtils.saveHeight({ height: 312.6, storage });
    expect(storage.values['ap.builder.logsPanelHeight']).toBe('313');
    expect(logsPanelLayoutUtils.readSavedHeight({ storage })).toBe(313);
  });

  it('returns no saved height when nothing, garbage or a non-positive value is stored', () => {
    expect(
      logsPanelLayoutUtils.readSavedHeight({ storage: memoryStorage() }),
    ).toBeNull();
    expect(
      logsPanelLayoutUtils.readSavedHeight({
        storage: memoryStorage({ 'ap.builder.logsPanelHeight': 'tall' }),
      }),
    ).toBeNull();
    expect(
      logsPanelLayoutUtils.readSavedHeight({
        storage: memoryStorage({ 'ap.builder.logsPanelHeight': '-4' }),
      }),
    ).toBeNull();
  });

  it('never restores a height below the minimum', () => {
    expect(
      logsPanelLayoutUtils.readSavedHeight({
        storage: memoryStorage({ 'ap.builder.logsPanelHeight': '40' }),
      }),
    ).toBe(LOGS_PANEL_LAYOUT.minHeight);
  });

  it('survives a storage that throws on read and write', () => {
    const storage = throwingStorage();
    expect(logsPanelLayoutUtils.readSavedHeight({ storage })).toBeNull();
    expect(() =>
      logsPanelLayoutUtils.saveHeight({ height: 300, storage }),
    ).not.toThrow();
    expect(logsPanelLayoutUtils.readSavedOpen({ storage })).toBe(false);
    expect(() =>
      logsPanelLayoutUtils.saveOpen({ open: true, storage }),
    ).not.toThrow();
    expect(logsPanelLayoutUtils.readSavedListWidth({ storage })).toBeNull();
    expect(() =>
      logsPanelLayoutUtils.saveListWidth({ width: 200, storage }),
    ).not.toThrow();
  });

  it('survives when there is no storage at all', () => {
    expect(logsPanelLayoutUtils.readSavedHeight({ storage: null })).toBeNull();
    expect(logsPanelLayoutUtils.readSavedOpen({ storage: null })).toBe(false);
    expect(() =>
      logsPanelLayoutUtils.saveHeight({ height: 300, storage: null }),
    ).not.toThrow();
  });

  it('round-trips the open state', () => {
    const storage = memoryStorage();
    logsPanelLayoutUtils.saveOpen({ open: true, storage });
    expect(storage.values['ap.builder.logsPanelOpen']).toBe('true');
    expect(logsPanelLayoutUtils.readSavedOpen({ storage })).toBe(true);
    logsPanelLayoutUtils.saveOpen({ open: false, storage });
    expect(logsPanelLayoutUtils.readSavedOpen({ storage })).toBe(false);
  });
});

describe('logs panel open height', () => {
  it('defaults to 30% of the canvas column', () => {
    expect(
      logsPanelLayoutUtils.resolveOpenHeight({
        columnHeight: 1000,
        savedHeight: null,
      }),
    ).toBe(300);
  });

  it('keeps the minimum of 160px on short columns', () => {
    expect(
      logsPanelLayoutUtils.resolveOpenHeight({
        columnHeight: 300,
        savedHeight: null,
      }),
    ).toBe(160);
  });

  it('caps a saved height at 75% of the column', () => {
    expect(
      logsPanelLayoutUtils.resolveOpenHeight({
        columnHeight: 800,
        savedHeight: 790,
      }),
    ).toBe(600);
  });

  it('follows the pointer while dragging, down to the collapsed bar', () => {
    expect(
      logsPanelLayoutUtils.resolveDragHeight({
        columnHeight: 800,
        rawHeight: 10,
      }),
    ).toBe(LOGS_PANEL_LAYOUT.collapsedHeight);
    expect(
      logsPanelLayoutUtils.resolveDragHeight({
        columnHeight: 800,
        rawHeight: 2000,
      }),
    ).toBe(600);
  });

  it('collapses when dropped below the minimum and saves otherwise', () => {
    expect(
      logsPanelLayoutUtils.resolveDrop({ columnHeight: 800, rawHeight: 120 }),
    ).toEqual({ collapse: true, height: null });
    expect(
      logsPanelLayoutUtils.resolveDrop({ columnHeight: 800, rawHeight: 420 }),
    ).toEqual({ collapse: false, height: 420 });
    expect(
      logsPanelLayoutUtils.resolveDrop({ columnHeight: 800, rawHeight: 900 }),
    ).toEqual({ collapse: false, height: 600 });
  });
});

describe('logs step list width', () => {
  it('defaults to the smaller of 240px and 20% of the panel', () => {
    expect(
      logsPanelLayoutUtils.resolveListWidth({ panelWidth: 1600, setting: null }),
    ).toEqual({ width: 240, full: false });
    expect(
      logsPanelLayoutUtils.resolveListWidth({ panelWidth: 1000, setting: null }),
    ).toEqual({ width: 200, full: false });
    expect(
      logsPanelLayoutUtils.resolveListWidth({ panelWidth: 300, setting: null }),
    ).toEqual({ width: 80, full: false });
  });

  it('clamps a saved width between 80 and 500px', () => {
    expect(
      logsPanelLayoutUtils.resolveListWidth({ panelWidth: 1600, setting: 900 }),
    ).toEqual({ width: 500, full: false });
  });

  it('fills the panel when dragged to the right edge', () => {
    expect(
      logsPanelLayoutUtils.listWidthFromOffset({
        panelWidth: 1000,
        offset: 990,
      }),
    ).toBe('full');
    expect(
      logsPanelLayoutUtils.resolveListWidth({
        panelWidth: 1000,
        setting: 'full',
      }),
    ).toEqual({ width: 1000, full: true });
    expect(
      logsPanelLayoutUtils.listWidthFromOffset({ panelWidth: 1000, offset: 40 }),
    ).toBe(80);
  });

  it('round-trips both a width and the full setting', () => {
    const storage = memoryStorage();
    logsPanelLayoutUtils.saveListWidth({ width: 321.4, storage });
    expect(logsPanelLayoutUtils.readSavedListWidth({ storage })).toBe(321);
    logsPanelLayoutUtils.saveListWidth({ width: 'full', storage });
    expect(storage.values['ap.builder.logsListWidth']).toBe('full');
    expect(logsPanelLayoutUtils.readSavedListWidth({ storage })).toBe('full');
  });
});

describe('logs panes', () => {
  it('shows only OUTPUT by default', () => {
    expect(DEFAULT_LOGS_PANES).toEqual({ input: false, output: true });
  });

  it('toggles a pane but never hides the last visible one', () => {
    const both = logsPanelLayoutUtils.togglePane({
      panes: DEFAULT_LOGS_PANES,
      pane: 'input',
    });
    expect(both).toEqual({ input: true, output: true });
    expect(
      logsPanelLayoutUtils.togglePane({ panes: both, pane: 'output' }),
    ).toEqual({ input: true, output: false });
    expect(
      logsPanelLayoutUtils.togglePane({
        panes: DEFAULT_LOGS_PANES,
        pane: 'output',
      }),
    ).toEqual(DEFAULT_LOGS_PANES);
  });

  it('keeps each pane at least 20% wide', () => {
    expect(logsPanelLayoutUtils.clampPaneRatio(0.05)).toBe(0.2);
    expect(logsPanelLayoutUtils.clampPaneRatio(0.95)).toBe(0.8);
    expect(logsPanelLayoutUtils.clampPaneRatio(0.4)).toBe(0.4);
  });
});
