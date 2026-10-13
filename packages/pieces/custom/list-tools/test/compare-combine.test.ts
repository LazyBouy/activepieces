/// <reference types="vitest/globals" />

import { createMockActionContext } from '@activepieces/pieces-framework';
import { combineListsAction } from '../src/lib/actions/combine-lists';
import { compareListsAction } from '../src/lib/actions/compare-lists';
import { merge } from '../src/lib/common/merge';
import { values } from '../src/lib/common/values';

const compareLists = (propsValue: Record<string, unknown>) =>
  compareListsAction.run(createMockActionContext({ propsValue }));
const combineLists = (propsValue: Record<string, unknown>) =>
  combineListsAction.run(createMockActionContext({ propsValue }));
const byId = [{ field_in_first: 'id', field_in_second: 'id' }];

describe('Compare Lists', () => {
  const crm = [
    { id: 1, name: 'Ann', email: 'ann@x', updatedAt: 'mon' },
    { id: 2, name: 'Bob', email: 'bob@x', updatedAt: 'mon' },
    { id: 3, name: 'Cleo', email: 'cleo@x' },
    { name: 'No id' },
  ];
  const billing = [
    { id: 2, name: 'Bob', email: 'BOB@x', updatedAt: 'tue' },
    { id: 1, name: 'Ann', email: 'ann@x', updatedAt: 'tue' },
    { id: 4, name: 'Dan' },
    { name: 'No id' },
  ];

  test('sorts entries into four groups with counts', async () => {
    const out = await compareLists({ first_list: crm, second_list: billing, match_on: byId, ignore_fields: 'updatedAt' });
    expect(out.same).toEqual([crm[0]]);
    expect(out.different).toEqual([{ first: crm[1], second: billing[0], changedFields: ['email'] }]);
    expect(out.onlyInFirst).toEqual([crm[2], crm[3]]);
    expect(out.onlyInSecond).toEqual([billing[2], billing[3]]);
    expect(out.counts).toEqual({ onlyInFirst: 2, onlyInSecond: 2, same: 1, different: 1 });
  });

  test('without ignored fields, every differing top-level field is listed, including missing ones', async () => {
    const out = await compareLists({ first_list: crm, second_list: billing, match_on: byId });
    expect(out.different.map((pair) => pair.changedFields)).toEqual([['updatedAt'], ['email', 'updatedAt']]);
    const missing = await compareLists({ first_list: [{ id: 1, a: 1 }], second_list: [{ id: 1, b: 1 }], match_on: byId });
    expect(missing.different[0].changedFields).toEqual(['a', 'b']);
  });

  test('case and numeric text options apply to keys and values', async () => {
    const insensitive = await compareLists({
      first_list: crm,
      second_list: billing,
      match_on: byId,
      ignore_fields: 'updatedAt',
      case_sensitive: false,
    });
    expect(insensitive.counts.same).toBe(2);
    const first = [{ id: 7, qty: 3 }];
    const second = [{ id: '7', qty: ' 3 ' }];
    expect((await compareLists({ first_list: first, second_list: second, match_on: byId })).counts.onlyInFirst).toBe(1);
    expect(
      (await compareLists({ first_list: first, second_list: second, match_on: byId, numbers_as_text: true })).counts.same,
    ).toBe(1);
  });

  test('each first entry pairs with the first not-yet-paired second entry; all key rows must match', async () => {
    const out = await compareLists({
      first_list: [{ k: 1, n: 'a' }, { k: 1, n: 'b' }, { k: 1, n: 'c' }],
      second_list: [{ k: 1, n: 'a' }, { k: 1, n: 'x' }],
      match_on: [{ field_in_first: 'k', field_in_second: 'k' }],
    });
    expect(out.same).toEqual([{ k: 1, n: 'a' }]);
    expect(out.different.map((pair) => values.readRecord(pair.second)['n'])).toEqual(['x']);
    expect(out.onlyInFirst).toEqual([{ k: 1, n: 'c' }]);
    const twoKeys = await compareLists({
      first_list: [{ a: 1, b: 2 }],
      second_list: [{ x: 1, y: 3 }],
      match_on: [
        { field_in_first: 'a', field_in_second: 'x' },
        { field_in_first: 'b', field_in_second: 'y' },
      ],
    });
    expect(twoKeys.counts).toEqual({ onlyInFirst: 1, onlyInSecond: 1, same: 0, different: 0 });
  });

  test('different key names and nested key paths; key fields are not compared', async () => {
    const out = await compareLists({
      first_list: [{ customer: { id: 'c1' }, total: 5 }],
      second_list: [{ customerId: 'c1', total: 5 }],
      match_on: [{ field_in_first: 'customer.id', field_in_second: 'customerId' }],
    });
    expect(out.counts.same).toBe(1);
  });

  test('stops without a complete key row or with entries that are not objects', async () => {
    await expect(
      compareLists({ first_list: [], second_list: [], match_on: [{ field_in_first: 'id', field_in_second: '' }] }),
    ).rejects.toThrow('Add at least one pair of fields to match on.');
    await expect(compareLists({ first_list: [], second_list: [1], match_on: byId })).rejects.toThrow(
      'Entry 1 of the Second list input is not an object.',
    );
    await expect(compareLists({ first_list: 'nope', second_list: [], match_on: byId })).rejects.toThrow(
      'The First list input must be a list',
    );
  });

  test('empty lists', async () => {
    expect(await compareLists({ first_list: [], second_list: [], match_on: byId })).toEqual({
      onlyInFirst: [],
      onlyInSecond: [],
      same: [],
      different: [],
      counts: { onlyInFirst: 0, onlyInSecond: 0, same: 0, different: 0 },
    });
  });
});

describe('Combine Lists', () => {
  const people = [
    { id: 1, name: 'Ann', address: { city: 'Paris', zip: '75001' } },
    { id: 2, name: 'Bob' },
    { id: 3, name: 'Cleo' },
  ];
  const orders = [
    { id: 1, total: 10, address: { city: 'Lyon' } },
    { id: 1, total: 20 },
    { id: 4, total: 5 },
  ];
  const match = (extra: Record<string, unknown>) =>
    combineLists({
      first_list: people,
      second_list: orders,
      how: 'match',
      ...extra,
      how_options: { match_on: byId, ...values.readRecord(extra['how_options']) },
    });

  test('one after the other allows plain entries', async () => {
    expect(await combineLists({ first_list: [1, { a: 1 }], second_list: ['x'] })).toEqual({
      items: [1, { a: 1 }, 'x'],
      count: 3,
    });
  });

  test('match by fields: one merged entry per match, in first-list order, nested objects merged', async () => {
    const out = await match({});
    expect(out.items).toEqual([
      { id: 1, name: 'Ann', address: { city: 'Lyon', zip: '75001' }, total: 10 },
      { id: 1, name: 'Ann', address: { city: 'Paris', zip: '75001' }, total: 20 },
    ]);
  });

  test('keep options add unmatched entries as they are', async () => {
    expect((await match({ how_options: { keep: 'all_first' } })).items.map((item) => values.readRecord(item)['id'])).toEqual([
      1, 1, 2, 3,
    ]);
    expect((await match({ how_options: { keep: 'all_second' } })).items.map((item) => values.readRecord(item)['id'])).toEqual([
      1, 1, 4,
    ]);
    expect((await match({ how_options: { keep: 'all_both' } })).count).toBe(5);
  });

  test('when both have a field: first value, or both renamed', async () => {
    const firstWins = await match({ how_options: { when_both: 'first' } });
    expect(firstWins.items[0]).toEqual({ id: 1, name: 'Ann', address: { city: 'Paris', zip: '75001' }, total: 10 });
    const renamed = await combineLists({
      first_list: [{ id: 1, v: 'a' }],
      second_list: [{ id: 1, v: 'b', w: 1 }],
      how: 'position',
      how_options: { when_both: 'both' },
    });
    expect(renamed.items).toEqual([{ first_id: 1, second_id: 1, first_v: 'a', second_v: 'b', w: 1 }]);
  });

  test('merge nested objects off replaces them', async () => {
    const out = await match({ merge_nested: false });
    expect(values.readRecord(out.items[0])['address']).toEqual({ city: 'Lyon' });
  });

  test('match options: case and numeric text', async () => {
    const first = [{ code: 'AB', n: 1 }];
    const second = [{ code: 'ab', m: 2 }];
    const pairs = { match_on: [{ field_in_first: 'code', field_in_second: 'code' }] };
    expect((await combineLists({ first_list: first, second_list: second, how: 'match', how_options: pairs })).count).toBe(0);
    expect(
      (
        await combineLists({
          first_list: first,
          second_list: second,
          how: 'match',
          how_options: pairs,
          more_options: { case_sensitive: false },
        })
      ).items,
    ).toEqual([{ code: 'ab', n: 1, m: 2 }]);
    const numeric = await combineLists({
      first_list: [{ id: 5 }],
      second_list: [{ id: '5', x: 1 }],
      how: 'match',
      how_options: { match_on: byId },
      more_options: { numbers_as_text: true },
    });
    expect(numeric.items).toEqual([{ id: '5', x: 1 }]);
  });

  test('pair by position, with and without unpaired entries', async () => {
    const first = [{ a: 1 }, { a: 2 }, { a: 3 }];
    const second = [{ b: 1 }];
    expect((await combineLists({ first_list: first, second_list: second, how: 'position' })).items).toEqual([{ a: 1, b: 1 }]);
    expect(
      (await combineLists({ first_list: first, second_list: second, how: 'position', more_options: { keep_unpaired: true } }))
        .items,
    ).toEqual([{ a: 1, b: 1 }, { a: 2 }, { a: 3 }]);
  });

  test('every combination, in first-list order', async () => {
    const out = await combineLists({
      first_list: [{ size: 'S' }, { size: 'M' }],
      second_list: [{ color: 'red' }, { color: 'blue' }],
      how: 'combination',
    });
    expect(out.items).toEqual([
      { size: 'S', color: 'red' },
      { size: 'S', color: 'blue' },
      { size: 'M', color: 'red' },
      { size: 'M', color: 'blue' },
    ]);
  });

  test('stops on plain entries outside One after the other, a missing key row, or too many combinations', async () => {
    await expect(combineLists({ first_list: [{ a: 1 }], second_list: [2], how: 'position' })).rejects.toThrow(
      'Entry 1 of the Second list input is not an object.',
    );
    await expect(combineLists({ first_list: [], second_list: [], how: 'match', how_options: {} })).rejects.toThrow(
      'Add at least one pair of fields to match on.',
    );
    const big = Array.from({ length: 400 }, (_, index) => ({ index }));
    await expect(combineLists({ first_list: big, second_list: big, how: 'combination' })).rejects.toThrow(
      'Every combination would create 160000 entries, more than the limit of 100000.',
    );
  });

  test('missing keys never match', async () => {
    const out = await combineLists({
      first_list: [{ name: 'x' }],
      second_list: [{ name: 'y' }],
      how: 'match',
      how_options: { match_on: byId, keep: 'all_both' },
    });
    expect(out.items).toEqual([{ name: 'x' }, { name: 'y' }]);
  });

  test('empty lists and input left unchanged', async () => {
    expect(await combineLists({ first_list: [], second_list: [], how: 'combination' })).toEqual({ items: [], count: 0 });
    const first = [{ id: 1, o: { a: 1 } }];
    const second = [{ id: 1, o: { b: 2 } }];
    await combineLists({ first_list: first, second_list: second, how: 'position' });
    expect(first).toEqual([{ id: 1, o: { a: 1 } }]);
    expect(second).toEqual([{ id: 1, o: { b: 2 } }]);
  });

  test('the merge helper keeps first-list key order and appends new keys', () => {
    expect(
      Object.keys(merge.combine({ first: { b: 1, a: 1 }, second: { c: 1, a: 2 }, rule: 'second', nested: true })),
    ).toEqual(['b', 'a', 'c']);
  });
});
