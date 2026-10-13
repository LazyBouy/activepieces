/// <reference types="vitest/globals" />

import { createMockActionContext } from '@activepieces/pieces-framework';
import { limitListAction } from '../src/lib/actions/limit-list';
import { removeDuplicatesAction } from '../src/lib/actions/remove-duplicates';
import { sortListAction } from '../src/lib/actions/sort-list';
import { values } from '../src/lib/common/values';

const sort = (propsValue: Record<string, unknown>) => sortListAction.run(createMockActionContext({ propsValue }));
const limit = (propsValue: Record<string, unknown>) => limitListAction.run(createMockActionContext({ propsValue }));
const dedupe = (propsValue: Record<string, unknown>) =>
  removeDuplicatesAction.run(createMockActionContext({ propsValue }));
const field = (items: unknown[], name: string) => items.map((item) => values.readRecord(item)[name]);

describe('Sort List', () => {
  const rows = [
    { id: 1, name: 'item 10', price: '5', when: '2024-02-01', group: 'b' },
    { id: 2, name: 'Item 2', price: 12, when: '2023-01-01', group: 'a' },
    { id: 3, name: 'item 1', when: 'later', group: 'b' },
    { id: 4, name: 'item 3', price: 'n/a', when: '2024-01-01T00:00:00Z', group: 'a' },
    { id: 5, name: null, price: 5, group: 'a' },
  ];
  const sortBy = (keys: Record<string, unknown>[], extra: Record<string, unknown> = {}) =>
    sort({ list: rows, sort_by: 'fields', sort_options: { sort_keys: keys }, ...extra });

  test('sorts text in natural order with missing values last in both directions', async () => {
    const ascending = await sortBy([{ field: 'name', direction: 'ascending', compare_as: 'text' }]);
    expect(field(ascending.items, 'id')).toEqual([3, 2, 4, 1, 5]);
    const descending = await sortBy([{ field: 'name', direction: 'descending', compare_as: 'text' }]);
    expect(field(descending.items, 'id')).toEqual([1, 4, 2, 3, 5]);
    expect(descending.count).toBe(5);
  });

  test('numbers: values that are not numbers go last keeping their order', async () => {
    const out = await sortBy([{ field: 'price', direction: 'descending', compare_as: 'number' }]);
    expect(field(out.items, 'id')).toEqual([2, 1, 5, 3, 4]);
  });

  test('dates use ISO text, unreadable dates go last', async () => {
    const out = await sortBy([{ field: 'when', direction: 'ascending', compare_as: 'date' }]);
    expect(field(out.items, 'id')).toEqual([2, 4, 1, 3, 5]);
  });

  test('automatic compares numbers when both are numbers, otherwise text', async () => {
    const out = await sortBy([{ field: 'price', direction: 'ascending', compare_as: 'auto' }]);
    expect(field(out.items, 'id')).toEqual([1, 5, 2, 4, 3]);
  });

  test('later rows break ties and the sort is stable', async () => {
    const out = await sortBy([
      { field: 'group', direction: 'ascending', compare_as: 'auto' },
      { field: 'id', direction: 'descending', compare_as: 'number' },
    ]);
    expect(field(out.items, 'id')).toEqual([5, 4, 2, 3, 1]);
    const stable = await sortBy([{ field: 'group', direction: 'ascending' }]);
    expect(field(stable.items, 'id')).toEqual([2, 4, 5, 1, 3]);
  });

  test('case option for text', async () => {
    const list = [{ v: 'b' }, { v: 'B' }, { v: 'a' }, { v: 'A' }];
    const insensitive = await sort({ list, sort_options: { sort_keys: [{ field: 'v' }] } });
    expect(field(insensitive.items, 'v')).toEqual(['a', 'A', 'b', 'B']);
    const sensitive = await sort({ list, sort_options: { sort_keys: [{ field: 'v' }] }, case_sensitive: true });
    expect(field(sensitive.items, 'v')).toEqual(['a', 'A', 'b', 'B']);
    const mixed = [{ v: 'B' }, { v: 'a' }, { v: 'b' }];
    const sensitiveMixed = await sort({ list: mixed, sort_options: { sort_keys: [{ field: 'v' }] }, case_sensitive: true });
    expect(field(sensitiveMixed.items, 'v')).toEqual(['a', 'b', 'B']);
    const insensitiveMixed = await sort({ list: mixed, sort_options: { sort_keys: [{ field: 'v' }] } });
    expect(field(insensitiveMixed.items, 'v')).toEqual(['a', 'B', 'b']);
  });

  test('nested paths', async () => {
    const out = await sort({
      list: [{ a: { b: 3 } }, { a: { b: 1 } }, { a: {} }, { a: { b: 2 } }],
      sort_options: { sort_keys: [{ field: 'a.b', compare_as: 'number' }] },
    });
    expect(out.items).toEqual([{ a: { b: 1 } }, { a: { b: 2 } }, { a: { b: 3 } }, { a: {} }]);
  });

  test('sorts the entries themselves, including plain values', async () => {
    const out = await sort({
      list: ['b', 10, 'a', 9, null, { x: 1 }],
      sort_by: 'entries',
      sort_options: { direction: 'descending' },
    });
    expect(out.items).toEqual(['b', 'a', 10, 9, null, { x: 1 }]);
  });

  test('random order keeps every entry', async () => {
    const list = Array.from({ length: 50 }, (_, index) => ({ id: index }));
    const out = await sort({ list, sort_by: 'random' });
    expect(out.count).toBe(50);
    expect([...field(out.items, 'id')].sort((a, b) => Number(a) - Number(b))).toEqual(field(list, 'id'));
  });

  test('stops when no row has a field, or entries are not objects', async () => {
    await expect(sort({ list: rows, sort_options: { sort_keys: [{ field: ' ' }] } })).rejects.toThrow(
      'Add at least one field to sort by.',
    );
    await expect(sort({ list: rows, sort_options: {} })).rejects.toThrow('Add at least one field to sort by.');
    await expect(sort({ list: [1, 2], sort_options: { sort_keys: [{ field: 'a' }] } })).rejects.toThrow(
      'Entry 1 of the List input is not an object.',
    );
  });

  test('an empty list', async () => {
    expect(await sort({ list: [], sort_options: { sort_keys: [{ field: 'a' }] } })).toEqual({ items: [], count: 0 });
  });

  test('does not change its input', async () => {
    const list = [{ a: 2 }, { a: 1 }];
    await sort({ list, sort_options: { sort_keys: [{ field: 'a' }] } });
    expect(list).toEqual([{ a: 2 }, { a: 1 }]);
  });
});

describe('Limit List', () => {
  const list = [1, 'two', { three: 3 }, [4], null];

  test('keeps the first or last entries in their original order', async () => {
    expect(await limit({ list, how_many: 2 })).toEqual({ items: [1, 'two'], count: 2, removedCount: 3 });
    expect(await limit({ list, how_many: 2, keep: 'last' })).toEqual({ items: [[4], null], count: 2, removedCount: 3 });
  });

  test('more than the list holds returns everything; 0 returns nothing', async () => {
    expect((await limit({ list, how_many: 10 })).count).toBe(5);
    expect(await limit({ list, how_many: 0, keep: 'last' })).toEqual({ items: [], count: 0, removedCount: 5 });
    expect(await limit({ list: [], how_many: 3 })).toEqual({ items: [], count: 0, removedCount: 0 });
  });

  test.each([-1, 1.5, 'abc', undefined])('stops for How many = %j', async (howMany) => {
    await expect(limit({ list, how_many: howMany })).rejects.toThrow('How many must be a whole number of 0 or more.');
  });
});

describe('Remove Duplicates', () => {
  test('whole entries compare deeply with key order ignored; 1 and "1" differ', async () => {
    const out = await dedupe({ list: [{ a: 1, b: 2 }, { b: 2, a: 1 }, { a: '1', b: 2 }, 1, '1', 1] });
    expect(out).toEqual({ items: [{ a: 1, b: 2 }, { a: '1', b: 2 }, 1, '1'], count: 4, removedCount: 2 });
  });

  test('keeps the last occurrence in the original relative order', async () => {
    const out = await dedupe({
      list: [{ id: 1, v: 'a' }, { id: 2 }, { id: 1, v: 'b' }, { id: 3 }],
      compare: 'only',
      fields_options: { fields: 'id' },
      keep: 'last',
    });
    expect(out.items).toEqual([{ id: 2 }, { id: 1, v: 'b' }, { id: 3 }]);
  });

  test('only these fields: missing compares as missing, nested paths work', async () => {
    const out = await dedupe({
      list: [{ c: { email: 'A@x' }, n: 1 }, { n: 2 }, { c: { email: 'a@x' }, n: 3 }, { n: 4 }, { c: { email: 'A@x' }, n: 5 }],
      compare: 'only',
      fields_options: { fields: 'c.email' },
    });
    expect(field(out.items, 'n')).toEqual([1, 2, 3]);
  });

  test('case option for text values', async () => {
    const list = [{ e: 'A@x' }, { e: 'a@x' }];
    expect((await dedupe({ list })).count).toBe(2);
    expect((await dedupe({ list, case_sensitive: false })).count).toBe(1);
  });

  test('all fields except removes the named paths, a parent excludes its children', async () => {
    const list = [
      { id: 1, meta: { at: 1 }, v: 'x' },
      { id: 2, meta: { at: 2 }, v: 'x' },
      { id: 3, meta: { at: 3 }, v: 'y' },
    ];
    const out = await dedupe({ list, compare: 'except', fields_options: { fields: 'id, meta' } });
    expect(field(out.items, 'id')).toEqual([1, 3]);
  });

  test('outputs only the compared fields when asked', async () => {
    const out = await dedupe({
      list: [{ id: 1, a: { b: 1, c: 2 } }, { id: 2, a: { b: 1, c: 3 } }],
      compare: 'only',
      fields_options: { fields: 'a.b' },
      output_options: { output_only_compared: true },
    });
    expect(out.items).toEqual([{ a: { b: 1 } }]);
  });

  test('stops without fields, or with plain entries for the field options', async () => {
    await expect(dedupe({ list: [{ a: 1 }], compare: 'only', fields_options: { fields: ' , ' } })).rejects.toThrow(
      'List the fields to compare, separated by commas.',
    );
    await expect(dedupe({ list: [{ a: 1 }, 2], compare: 'except', fields_options: { fields: 'a' } })).rejects.toThrow(
      'Entry 2 of the List input is not an object.',
    );
  });

  test('an empty list', async () => {
    expect(await dedupe({ list: [] })).toEqual({ items: [], count: 0, removedCount: 0 });
  });
});
