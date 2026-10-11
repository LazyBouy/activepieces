import { describe, expect, it } from 'vitest';

import { LayoutStorage } from '@/app/builder/step-modal/step-modal-layout-utils';
import { viewModeUtils } from '@/app/builder/step-modal/view-mode-utils';

describe('viewModeUtils.buildTableModel', () => {
  it('builds one row per item with the union of keys in first-seen order', () => {
    const model = viewModeUtils.buildTableModel([
      { id: 1, name: 'a' },
      { id: 2, email: 'b@x.com' },
    ]);
    expect(model.kind).toBe('objects');
    expect(model.columns).toEqual(['id', 'name', 'email']);
    expect(model.rows).toEqual([
      [1, 'a', undefined],
      [2, undefined, 'b@x.com'],
    ]);
  });

  it('shows a single object as one row', () => {
    const model = viewModeUtils.buildTableModel({ a: 1, b: { c: true } });
    expect(model).toEqual({
      kind: 'single',
      columns: ['a', 'b'],
      rows: [[1, { c: true }]],
    });
  });

  it('shows plain values in one Value column', () => {
    const model = viewModeUtils.buildTableModel([1, 2, 3]);
    expect(model.kind).toBe('values');
    expect(model.columns).toEqual([viewModeUtils.VALUE_COLUMN]);
    expect(model.rows).toEqual([[1], [2], [3]]);
  });

  it('treats empty data as empty', () => {
    expect(viewModeUtils.buildTableModel([]).kind).toBe('empty');
    expect(viewModeUtils.buildTableModel({}).kind).toBe('empty');
    expect(viewModeUtils.buildTableModel(null).kind).toBe('empty');
  });
});

describe('viewModeUtils.getColumnPath', () => {
  it('maps a column to the key under the first item', () => {
    const model = viewModeUtils.buildTableModel([{ 'first name': 1 }]);
    expect(
      viewModeUtils.getColumnPath({
        basePath: "step_1['output']",
        model,
        columnIndex: 0,
      }),
    ).toBe("step_1['output'][0]['first name']");
  });

  it('maps a single object column to its key', () => {
    const model = viewModeUtils.buildTableModel({ "it's": 1 });
    expect(
      viewModeUtils.getColumnPath({
        basePath: "trigger['output']",
        model,
        columnIndex: 0,
      }),
    ).toBe("trigger['output']['it\\'s']");
  });
});

describe('viewModeUtils formatting and kinds', () => {
  it('formats cells as one-line text', () => {
    expect(viewModeUtils.formatCell('text')).toBe('text');
    expect(viewModeUtils.formatCell(3)).toBe('3');
    expect(viewModeUtils.formatCell(null)).toBe('null');
    expect(viewModeUtils.formatCell(undefined)).toBe('');
    expect(viewModeUtils.formatCell({ a: [1, 2] })).toBe('{"a":[1,2]}');
    expect(
      viewModeUtils.formatCell({ long: 'x'.repeat(200) }).endsWith('…'),
    ).toBe(true);
  });

  it('detects value kinds for the schema icons', () => {
    expect(viewModeUtils.getValueKind('a')).toBe('string');
    expect(viewModeUtils.getValueKind(1)).toBe('number');
    expect(viewModeUtils.getValueKind(false)).toBe('boolean');
    expect(viewModeUtils.getValueKind({})).toBe('object');
    expect(viewModeUtils.getValueKind([])).toBe('array');
    expect(viewModeUtils.getValueKind(null)).toBe('null');
  });

  it('counts items only for arrays', () => {
    expect(viewModeUtils.getItemCount([1, 2])).toBe(2);
    expect(viewModeUtils.getItemCount({ a: 1 })).toBeNull();
  });
});

describe('viewModeUtils view mode storage', () => {
  it('defaults the input pane to Schema and the output pane to Table', () => {
    expect(viewModeUtils.DEFAULT_VIEW_MODES).toEqual({
      input: 'schema',
      output: 'table',
    });
    expect(viewModeUtils.readViewMode({ pane: 'input', storage: null })).toBe(
      'schema',
    );
  });

  it('remembers the last choice per pane', () => {
    const values = new Map<string, string>();
    const storage: LayoutStorage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        values.set(key, value);
      },
      removeItem: (key) => {
        values.delete(key);
      },
    };
    viewModeUtils.saveViewMode({ pane: 'output', mode: 'json', storage });
    expect(viewModeUtils.readViewMode({ pane: 'output', storage })).toBe(
      'json',
    );
    expect(viewModeUtils.readViewMode({ pane: 'input', storage })).toBe(
      'schema',
    );
  });

  it('falls back to the defaults when storage throws or holds junk', () => {
    const throwing: LayoutStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    expect(
      viewModeUtils.readViewMode({ pane: 'output', storage: throwing }),
    ).toBe('table');
    expect(() =>
      viewModeUtils.saveViewMode({
        pane: 'output',
        mode: 'schema',
        storage: throwing,
      }),
    ).not.toThrow();
    const junk: LayoutStorage = {
      getItem: () => 'grid',
      setItem: () => undefined,
      removeItem: () => undefined,
    };
    expect(viewModeUtils.readViewMode({ pane: 'input', storage: junk })).toBe(
      'schema',
    );
  });
});
