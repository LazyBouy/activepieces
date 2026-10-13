/// <reference types="vitest/globals" />

import { createMockActionContext } from '@activepieces/pieces-framework';
import { filterListAction } from '../src/lib/actions/filter-list';
import { values } from '../src/lib/common/values';

const run = (propsValue: Record<string, unknown>) => filterListAction.run(createMockActionContext({ propsValue }));

const people = [
  { name: 'Ann', age: 34, active: true, joined: '2024-01-10', tags: ['vip', 'eu'], city: 'Paris', note: '' },
  { name: 'bob', age: '19', active: 'false', joined: '2023-06-01T08:00:00Z', tags: [], city: 'Berlin' },
  { name: 'Cleo', age: 'unknown', active: 1, joined: 1710000000000, tags: ['us', 7], address: { city: 'Austin' } },
  { name: 'Dan', age: null, active: 0, tags: 'not a list', note: 'hello' },
];

const names = (items: unknown[]) => items.map((item) => values.readRecord(item)['name']);

const filter = async (row: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  names((await run({ list: people, conditions: [row], ...extra })).kept);

describe('Filter List', () => {
  test('returns kept and removed entries in their original order, with counts', async () => {
    const out = await run({ list: people, conditions: [{ field: 'age', operator: 'number_greater', value: '20' }] });
    expect(names(out.kept)).toEqual(['Ann']);
    expect(names(out.removed)).toEqual(['bob', 'Cleo', 'Dan']);
    expect(out.keptCount).toBe(1);
    expect(out.removedCount).toBe(3);
  });

  test('exists means present and not null; is empty follows the empty rule', async () => {
    expect(await filter({ field: 'age', operator: 'exists' })).toEqual(['Ann', 'bob', 'Cleo']);
    expect(await filter({ field: 'age', operator: 'does_not_exist' })).toEqual(['Dan']);
    expect(await filter({ field: 'note', operator: 'is_empty' })).toEqual(['Ann', 'bob', 'Cleo']);
    expect(await filter({ field: 'tags', operator: 'is_not_empty' })).toEqual(['Ann', 'Cleo', 'Dan']);
  });

  test('text operators are case-insensitive by default and follow the case option', async () => {
    expect(await filter({ field: 'name', operator: 'text_exactly_matches', value: 'BOB' })).toEqual(['bob']);
    expect(
      await filter({ field: 'name', operator: 'text_exactly_matches', value: 'BOB' }, { case_sensitive: true }),
    ).toEqual([]);
    expect(await filter({ field: 'name', operator: 'text_starts_with', value: 'c' })).toEqual(['Cleo']);
    expect(await filter({ field: 'name', operator: 'text_ends_with', value: 'N' })).toEqual(['Ann', 'Dan']);
    expect(await filter({ field: 'name', operator: 'text_contains', value: 'o' })).toEqual(['bob', 'Cleo']);
    expect(await filter({ field: 'name', operator: 'text_does_not_contain', value: 'o' })).toEqual(['Ann', 'Dan']);
    expect(await filter({ field: 'name', operator: 'text_does_not_start_with', value: 'a' })).toEqual([
      'bob',
      'Cleo',
      'Dan',
    ]);
    expect(await filter({ field: 'name', operator: 'text_does_not_end_with', value: 'n' })).toEqual(['bob', 'Cleo']);
    expect(await filter({ field: 'name', operator: 'text_does_not_exactly_match', value: 'ann' })).toEqual([
      'bob',
      'Cleo',
      'Dan',
    ]);
  });

  test('text operators read numbers and booleans as text but never objects, lists or missing fields', async () => {
    expect(await filter({ field: 'age', operator: 'text_exactly_matches', value: '34' })).toEqual(['Ann']);
    expect(await filter({ field: 'active', operator: 'text_exactly_matches', value: 'TRUE' })).toEqual(['Ann']);
    expect(await filter({ field: 'tags', operator: 'text_does_not_contain', value: 'zzz' })).toEqual(['Dan']);
    expect(await filter({ field: 'city', operator: 'text_does_not_contain', value: 'zzz' })).toEqual(['Ann', 'bob']);
  });

  test('a pattern follows the case option', async () => {
    expect(await filter({ field: 'name', operator: 'text_matches_pattern', value: '^[a-c]' })).toEqual([
      'Ann',
      'bob',
      'Cleo',
    ]);
    expect(
      await filter({ field: 'name', operator: 'text_matches_pattern', value: '^[a-c]' }, { case_sensitive: true }),
    ).toEqual(['bob']);
  });

  test('number operators skip values that are not numbers', async () => {
    expect(await filter({ field: 'age', operator: 'number_equal', value: ' 19 ' })).toEqual(['bob']);
    expect(await filter({ field: 'age', operator: 'number_not_equal', value: '19' })).toEqual(['Ann']);
    expect(await filter({ field: 'age', operator: 'number_greater_or_equal', value: '19' })).toEqual(['Ann', 'bob']);
    expect(await filter({ field: 'age', operator: 'number_less', value: '34' })).toEqual(['bob']);
    expect(await filter({ field: 'age', operator: 'number_less_or_equal', value: '34' })).toEqual(['Ann', 'bob']);
    expect(await filter({ field: 'age', operator: 'number_greater', value: 'abc' })).toEqual([]);
  });

  test('boolean operators read true/false, their text and 1/0', async () => {
    expect(await filter({ field: 'active', operator: 'boolean_true' })).toEqual(['Ann', 'Cleo']);
    expect(await filter({ field: 'active', operator: 'boolean_false' })).toEqual(['bob', 'Dan']);
  });

  test('date operators read ISO text and milliseconds', async () => {
    expect(await filter({ field: 'joined', operator: 'date_after', value: '2023-12-31' })).toEqual(['Ann', 'Cleo']);
    expect(await filter({ field: 'joined', operator: 'date_before', value: '2024-01-01T00:00:00Z' })).toEqual([
      'bob',
    ]);
    expect(await filter({ field: 'joined', operator: 'date_equals', value: '2024-01-10T00:00:00.000Z' })).toEqual([
      'Ann',
    ]);
    expect(await filter({ field: 'joined', operator: 'date_after', value: 'not a date' })).toEqual([]);
  });

  test('list operators use deep equality and the case option', async () => {
    expect(await filter({ field: 'tags', operator: 'list_contains', value: 'VIP' })).toEqual(['Ann']);
    expect(await filter({ field: 'tags', operator: 'list_contains', value: 'VIP' }, { case_sensitive: true })).toEqual(
      [],
    );
    expect(await filter({ field: 'tags', operator: 'list_contains', value: '7' })).toEqual(['Cleo']);
    expect(await filter({ field: 'tags', operator: 'list_does_not_contain', value: 'vip' })).toEqual(['bob', 'Cleo']);
    expect(await filter({ field: 'tags', operator: 'list_is_empty' })).toEqual(['bob']);
    expect(await filter({ field: 'tags', operator: 'list_is_not_empty' })).toEqual(['Ann', 'Cleo']);
    expect(await filter({ field: 'tags', operator: 'list_has_length', value: '2' })).toEqual(['Ann', 'Cleo']);
  });

  test('list contains matches objects deeply with key order ignored', async () => {
    const out = await run({
      list: [{ items: [{ b: 2, a: 1 }] }, { items: [{ a: 1 }] }],
      conditions: [{ field: 'items', operator: 'list_contains', value: '{"a":1,"b":2}' }],
    });
    expect(out.keptCount).toBe(1);
  });

  test('reads nested paths', async () => {
    expect(await filter({ field: 'address.city', operator: 'text_exactly_matches', value: 'austin' })).toEqual([
      'Cleo',
    ]);
    expect(await filter({ field: 'tags.0', operator: 'text_exactly_matches', value: 'us' })).toEqual(['Cleo']);
  });

  test('all conditions or any condition', async () => {
    const rows = [
      { field: 'age', operator: 'number_greater', value: '18' },
      { field: 'name', operator: 'text_starts_with', value: 'a' },
    ];
    expect(names((await run({ list: people, conditions: rows })).kept)).toEqual(['Ann']);
    expect(names((await run({ list: people, conditions: rows, match: 'any' })).kept)).toEqual(['Ann', 'bob']);
  });

  test('an empty list returns empty outputs', async () => {
    const out = await run({ list: [], conditions: [{ field: 'a', operator: 'exists' }] });
    expect(out).toEqual({ kept: [], removed: [], keptCount: 0, removedCount: 0 });
  });

  test('accepts JSON text', async () => {
    const out = await run({ list: '[{"a":1},{"a":2}]', conditions: [{ field: 'a', operator: 'number_equal', value: '2' }] });
    expect(out.kept).toEqual([{ a: 2 }]);
  });

  test('stops on a missing field, an invalid pattern, a non-list or a non-object entry', async () => {
    await expect(run({ list: people, conditions: [{ field: '', operator: 'exists' }] })).rejects.toThrow(
      'Add at least one condition with a field.',
    );
    await expect(
      run({ list: people, conditions: [{ field: 'name', operator: 'text_matches_pattern', value: '[' }] }),
    ).rejects.toThrow('The pattern in condition 1 is not a valid regular expression.');
    await expect(run({ list: { a: 1 }, conditions: [{ field: 'a', operator: 'exists' }] })).rejects.toThrow(
      'The List input must be a list',
    );
    await expect(run({ list: [{ a: 1 }, 2], conditions: [{ field: 'a', operator: 'exists' }] })).rejects.toThrow(
      'Entry 2 of the List input is not an object.',
    );
  });

  test('does not change its input', async () => {
    const list = [{ a: 1 }, { a: 2 }];
    const snapshot = JSON.stringify(list);
    await run({ list, conditions: [{ field: 'a', operator: 'number_equal', value: '1' }] });
    expect(JSON.stringify(list)).toBe(snapshot);
  });
});
