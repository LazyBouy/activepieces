/// <reference types="vitest/globals" />

import { createMockActionContext } from '@activepieces/pieces-framework';
import { collectValuesAction } from '../src/lib/actions/collect-values';
import { expandNestedListAction } from '../src/lib/actions/expand-nested-list';
import { groupAndSummarizeAction } from '../src/lib/actions/group-and-summarize';
import { renameFieldsAction } from '../src/lib/actions/rename-fields';
import { setFieldsAction } from '../src/lib/actions/set-fields';
import { calculations } from '../src/lib/common/calculations';
import { templates } from '../src/lib/common/templates';
import { values } from '../src/lib/common/values';

const expand = (propsValue: Record<string, unknown>) =>
  expandNestedListAction.run(createMockActionContext({ propsValue }));
const collect = (propsValue: Record<string, unknown>) => collectValuesAction.run(createMockActionContext({ propsValue }));
const group = (propsValue: Record<string, unknown>) =>
  groupAndSummarizeAction.run(createMockActionContext({ propsValue }));
const rename = (propsValue: Record<string, unknown>) => renameFieldsAction.run(createMockActionContext({ propsValue }));
const setFields = (propsValue: Record<string, unknown>) => setFieldsAction.run(createMockActionContext({ propsValue }));

describe('Expand Nested List', () => {
  const orders = [
    { id: 1, customer: 'Ann', lines: [{ sku: 'A', qty: 1 }, { sku: 'B', qty: 2 }] },
    { id: 2, customer: 'Bob', lines: [] },
    { id: 3, customer: 'Cleo', lines: 'C' },
    { id: 4, customer: 'Dan' },
    { id: 5, customer: 'Eve', lines: [7, null] },
  ];

  test('keeps all other fields by default and puts each element under the last segment', async () => {
    const out = await expand({ list: orders, field_to_expand: 'lines' });
    expect(out.items).toEqual([
      { id: 1, customer: 'Ann', lines: { sku: 'A', qty: 1 } },
      { id: 1, customer: 'Ann', lines: { sku: 'B', qty: 2 } },
      { id: 3, customer: 'Cleo', lines: 'C' },
      { id: 5, customer: 'Eve', lines: 7 },
      { id: 5, customer: 'Eve', lines: null },
    ]);
    expect(out.count).toBe(5);
  });

  test('No: an object element becomes the entry, a plain value goes under the field name', async () => {
    const out = await expand({ list: orders, field_to_expand: 'lines', keep_other_fields: 'no', put_each_element_in: 'line' });
    expect(out.items).toEqual([{ sku: 'A', qty: 1 }, { sku: 'B', qty: 2 }, { line: 'C' }, { line: 7 }, { line: null }]);
  });

  test('Only these keeps the listed fields', async () => {
    const out = await expand({
      list: orders.slice(0, 1),
      field_to_expand: 'lines',
      keep_other_fields: 'only',
      keep_options: { fields_to_keep: 'id' },
      put_each_element_in: 'line',
    });
    expect(out.items).toEqual([
      { id: 1, line: { sku: 'A', qty: 1 } },
      { id: 1, line: { sku: 'B', qty: 2 } },
    ]);
  });

  test('nested paths', async () => {
    const out = await expand({ list: [{ order: { no: 9, items: ['x', 'y'] } }], field_to_expand: 'order.items' });
    expect(out.items).toEqual([
      { order: { no: 9 }, items: 'x' },
      { order: { no: 9 }, items: 'y' },
    ]);
  });

  test('an empty list, a missing field setting, and plain entries', async () => {
    expect(await expand({ list: [], field_to_expand: 'a' })).toEqual({ items: [], count: 0 });
    await expect(expand({ list: orders, field_to_expand: ' ' })).rejects.toThrow('Enter the field to expand.');
    await expect(expand({ list: [1], field_to_expand: 'a' })).rejects.toThrow('Entry 1 of the List input is not an object.');
  });
});

describe('Collect Values', () => {
  const people = [
    { name: 'Ann', email: 'a@x', tags: ['a', 'b'], address: { city: 'Paris' } },
    { name: 'Bob', tags: ['b'], address: { city: 'Paris' } },
    { name: 'Ann', email: null, tags: [], address: {} },
  ];

  test('one list per row; Save as defaults to the path with dots as underscores', async () => {
    const out = await collect({
      list: people,
      fields: [{ field: 'name' }, { field: 'address.city' }, { field: 'email', save_as: 'emails' }],
    });
    expect(out).toEqual({ name: ['Ann', 'Bob', 'Ann'], address_city: ['Paris', 'Paris'], emails: ['a@x'] });
  });

  test('keep empty values turns missing and null into null entries', async () => {
    const out = await collect({ list: people, fields: [{ field: 'email' }], keep_empty_values: true });
    expect(out).toEqual({ email: ['a@x', null, null] });
  });

  test('flatten lists adds inner entries one level', async () => {
    expect(await collect({ list: people, fields: [{ field: 'tags' }] })).toEqual({ tags: [['a', 'b'], ['b'], []] });
    expect(await collect({ list: people, fields: [{ field: 'tags' }], flatten_lists: true })).toEqual({
      tags: ['a', 'b', 'b'],
    });
  });

  test('unique values only keeps the first, comparing deeply', async () => {
    const out = await collect({
      list: [{ v: { a: 1, b: 2 } }, { v: { b: 2, a: 1 } }, { v: 1 }, { v: '1' }, { v: 'Ann' }, { v: 'ann' }],
      fields: [{ field: 'v' }],
      unique_values_only: true,
    });
    expect(out).toEqual({ v: [{ a: 1, b: 2 }, 1, '1', 'Ann', 'ann'] });
  });

  test('stops when two rows save under the same name or no row has a field', async () => {
    await expect(collect({ list: people, fields: [{ field: 'a.b' }, { field: 'x', save_as: 'a_b' }] })).rejects.toThrow(
      'Each field must be saved under a different name.',
    );
    await expect(collect({ list: people, fields: [{ field: '' }] })).rejects.toThrow('Add at least one field to collect.');
  });

  test('an empty list gives empty lists', async () => {
    expect(await collect({ list: [], fields: [{ field: 'a' }] })).toEqual({ a: [] });
  });
});

describe('Group and Summarize', () => {
  const sales = [
    { region: 'EU', rep: 'Ann', amount: 10, at: '2024-03-01', note: 'x' },
    { region: 'US', rep: 'Bob', amount: '5', at: '2024-01-01' },
    { region: 'EU', rep: 'ann', amount: 'n/a', at: '2023-12-31', note: '' },
    { region: 'EU', rep: 'Ann', amount: 2.5, note: 'y' },
    { rep: 'Cleo', amount: 1 },
  ];

  test('groups by field in order of first appearance with default names', async () => {
    const out = await group({
      list: sales,
      group_by: 'region',
      calculations: [
        { field: '', calculation: 'count' },
        { field: 'amount', calculation: 'sum' },
        { field: 'amount', calculation: 'average' },
        { field: 'rep', calculation: 'count_unique' },
      ],
    });
    expect(out.groups).toEqual([
      { region: 'EU', count: 3, amountSum: 12.5, amountAverage: 6.25, repCountUnique: 2 },
      { region: 'US', count: 1, amountSum: 5, amountAverage: 5, repCountUnique: 1 },
      { region: null, count: 1, amountSum: 1, amountAverage: 1, repCountUnique: 1 },
    ]);
    expect(out.count).toBe(3);
  });

  test('skips entries without a group value when asked', async () => {
    const out = await group({ list: sales, group_by: 'region', skip_without_group: true });
    expect(out.groups).toEqual([
      { region: 'EU', count: 3 },
      { region: 'US', count: 1 },
    ]);
  });

  test('without grouping returns one summary, even for an empty list', async () => {
    expect((await group({ list: sales, calculations: [{ field: 'amount', calculation: 'sum' }] })).groups).toEqual([
      { amountSum: 18.5 },
    ]);
    expect(
      await group({
        list: [],
        calculations: [
          { field: 'a', calculation: 'sum' },
          { field: 'a', calculation: 'average' },
          { field: 'a', calculation: 'minimum' },
          { field: 'a', calculation: 'count' },
        ],
      }),
    ).toEqual({ groups: [{ aSum: 0, aAverage: null, aMinimum: null, aCount: 0 }], count: 1 });
  });

  test('count, list and join ignore empty values; first and last do not', async () => {
    const out = await group({
      list: sales,
      calculations: [
        { field: 'note', calculation: 'count' },
        { field: 'note', calculation: 'list' },
        { field: 'note', calculation: 'join', save_as: 'notes' },
        { field: 'note', calculation: 'first' },
        { field: 'note', calculation: 'last' },
      ],
      join_with: ' | ',
    });
    expect(out.groups).toEqual([
      { noteCount: 2, noteListOfValues: ['x', 'y'], notes: 'x | y', noteFirstValue: 'x', noteLastValue: null },
    ]);
  });

  test('minimum and maximum compare numbers, then dates, then text', async () => {
    const out = await group({
      list: sales,
      calculations: [
        { field: 'at', calculation: 'minimum' },
        { field: 'at', calculation: 'maximum' },
        { field: 'rep', calculation: 'minimum' },
        { field: 'rep', calculation: 'maximum' },
        { field: 'amount', calculation: 'maximum', save_as: 'mixed' },
      ],
    });
    expect(out.groups).toEqual([
      { atMinimum: '2023-12-31', atMaximum: '2024-03-01', repMinimum: 'Ann', repMaximum: 'Cleo', mixed: 'n/a' },
    ]);
    const numeric = await group({ list: [{ v: '10' }, { v: 9 }, { v: null }], calculations: [{ field: 'v', calculation: 'maximum' }] });
    expect(numeric.groups).toEqual([{ vMaximum: '10' }]);
  });

  test('group values are case-sensitive and compare deeply; nested group fields get underscore names', async () => {
    const out = await group({
      list: [
        { c: { country: 'fr' }, k: { a: 1, b: 2 } },
        { c: { country: 'FR' }, k: { b: 2, a: 1 } },
        { c: { country: 'fr' }, k: { a: 1, b: 2 } },
      ],
      group_by: 'c.country, k',
      calculations: [{ field: '', calculation: 'count' }],
    });
    expect(out.groups).toEqual([
      { c_country: 'fr', k: { a: 1, b: 2 }, count: 2 },
      { c_country: 'FR', k: { b: 2, a: 1 }, count: 1 },
    ]);
  });

  test('stops on duplicate names or a missing field', async () => {
    await expect(
      group({
        list: sales,
        calculations: [
          { field: 'amount', calculation: 'sum' },
          { field: 'x', calculation: 'count', save_as: 'amountSum' },
        ],
      }),
    ).rejects.toThrow('Each calculation must be saved under a different name.');
    await expect(group({ list: sales, calculations: [{ field: '', calculation: 'sum' }] })).rejects.toThrow(
      'Calculation 1 needs a field.',
    );
  });

  test('default names', () => {
    expect(calculations.defaultName({ fieldText: 'amount', calculation: 'sum' })).toBe('amountSum');
    expect(calculations.defaultName({ fieldText: 'customer', calculation: 'count_unique' })).toBe('customerCountUnique');
    expect(calculations.defaultName({ fieldText: 'order.total', calculation: 'average' })).toBe('order_totalAverage');
    expect(calculations.defaultName({ fieldText: '', calculation: 'count' })).toBe('count');
  });
});

describe('Rename Fields', () => {
  test('renames keep their position, read from the original so a swap works', async () => {
    const out = await rename({
      list: [{ a: 1, b: 2, c: 3 }],
      renames: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'a' },
      ],
    });
    expect(out.items).toEqual([{ b: 1, a: 2, c: 3 }]);
    expect(Object.keys(values.readRecord(out.items[0]))).toEqual(['b', 'a', 'c']);
  });

  test('a missing From is skipped and renaming onto an existing field replaces it', async () => {
    const out = await rename({
      list: [{ id: 1, name: 'x', title: 'old' }, { id: 2 }],
      renames: [
        { from: 'name', to: 'title' },
        { from: 'nope', to: 'id' },
      ],
    });
    expect(out.items).toEqual([{ id: 1, title: 'x' }, { id: 2 }]);
  });

  test('nested paths, in place and moved', async () => {
    const out = await rename({
      list: [{ customer: { first: 'Ann', city: 'Paris' }, n: 1 }],
      renames: [
        { from: 'customer.first', to: 'customer.firstName' },
        { from: 'customer.city', to: 'city' },
      ],
    });
    expect(out.items).toEqual([{ customer: { firstName: 'Ann' }, n: 1, city: 'Paris' }]);
  });

  test('pattern rules apply in order, to every match, respecting case and nested levels', async () => {
    const list = [{ user_id: 1, user_name: 'Ann', Meta: { user_role: 'admin', deep: { user_x: 1 } }, items: [{ user_q: 1 }] }];
    const all = await rename({
      list,
      pattern_renames: [
        { pattern: '^user_', replace_with: '' },
        { pattern: '_(\\w)', replace_with: '-$1' },
      ],
    });
    expect(all.items).toEqual([{ id: 1, name: 'Ann', Meta: { role: 'admin', deep: { x: 1 } }, items: [{ q: 1 }] }]);
    const topOnly = await rename({ list, pattern_renames: [{ pattern: 'USER_', replace_with: 'u.', case_sensitive: false, nested_levels: 0 }] });
    expect(topOnly.items).toEqual([
      { 'u.id': 1, 'u.name': 'Ann', Meta: { user_role: 'admin', deep: { user_x: 1 } }, items: [{ user_q: 1 }] },
    ]);
    const oneLevel = await rename({ list, pattern_renames: [{ pattern: 'user_', replace_with: '', nested_levels: 1 }] });
    expect(oneLevel.items).toEqual([{ id: 1, name: 'Ann', Meta: { role: 'admin', deep: { user_x: 1 } }, items: [{ q: 1 }] }]);
    const caseSensitive = await rename({ list, pattern_renames: [{ pattern: 'META', replace_with: 'm' }] });
    expect(caseSensitive.items).toEqual(list);
  });

  test('renames run before pattern rules', async () => {
    const out = await rename({
      list: [{ a: 1 }],
      renames: [{ from: 'a', to: 'user_a' }],
      pattern_renames: [{ pattern: '^user_', replace_with: 'u_' }],
    });
    expect(out.items).toEqual([{ u_a: 1 }]);
  });

  test('stops on an invalid pattern', async () => {
    await expect(
      rename({ list: [{ a: 1 }], pattern_renames: [{ pattern: 'ok', replace_with: '' }, { pattern: '(', replace_with: '' }] }),
    ).rejects.toThrow('Pattern 2 is not a valid regular expression.');
  });

  test('an empty list', async () => {
    expect(await rename({ list: [], renames: [{ from: 'a', to: 'b' }] })).toEqual({ items: [], count: 0 });
  });
});

describe('Set Fields', () => {
  const people = [
    { id: 1, first: 'Ann', last: 'Lee', age: '34', meta: { vip: 'TRUE' } },
    { id: 2, first: 'Bob', age: 'unknown' },
  ];

  test('fixed values, other fields and text templates', async () => {
    const out = await setFields({
      list: people,
      set_fields: [
        { field: 'status', value_from: 'fixed', value: 'active' },
        { field: 'years', value_from: 'field', value: 'age' },
        { field: 'full', value_from: 'template', value: '{first} {last} ({meta.vip}) {not a path} {}' },
      ],
    });
    expect(out.items).toEqual([
      { id: 1, first: 'Ann', last: 'Lee', age: '34', meta: { vip: 'TRUE' }, status: 'active', years: '34', full: 'Ann Lee (TRUE) {not a path} {}' },
      { id: 2, first: 'Bob', age: 'unknown', status: 'active', years: 'unknown', full: 'Bob  () {not a path} {}' },
    ]);
  });

  test('type conversion follows the value rules', async () => {
    const out = await setFields({
      list: [people[0]],
      set_fields: [
        { field: 'age', value_from: 'field', value: 'age', type: 'number' },
        { field: 'vip', value_from: 'field', value: 'meta.vip', type: 'boolean' },
        { field: 'meta', value_from: 'field', value: 'meta', type: 'text' },
        { field: 'tags', value_from: 'fixed', value: '["a", 1]', type: 'list' },
        { field: 'extra', value_from: 'fixed', value: '{"k": true}', type: 'object' },
        { field: 'idText', value_from: 'field', value: 'id', type: 'text' },
      ],
    });
    expect(out.items).toEqual([
      { id: 1, first: 'Ann', last: 'Lee', age: 34, meta: '{"vip":"TRUE"}', vip: true, tags: ['a', 1], extra: { k: true }, idText: '1' },
    ]);
  });

  test('a failed conversion stops the step, or keeps the unconverted value when allowed', async () => {
    const rows = [{ field: 'age', value_from: 'field', value: 'age', type: 'number' }];
    await expect(setFields({ list: people, set_fields: rows })).rejects.toThrow('Entry 2: age cannot be converted to a number.');
    const out = await setFields({ list: people, set_fields: rows, stop_on_conversion_errors: false });
    expect(out.items.map((item) => values.readRecord(item)['age'])).toEqual([34, 'unknown']);
  });

  test('keep existing fields: only these, all except, none; set fields come after, existing ones keep their place', async () => {
    const only = await setFields({
      list: [people[0]],
      keep_existing_fields: 'only',
      keep_options: { fields: 'last, id' },
      set_fields: [
        { field: 'id', value_from: 'fixed', value: '9', type: 'number' },
        { field: 'new', value_from: 'fixed', value: 'x' },
      ],
    });
    expect(only.items).toEqual([{ id: 9, last: 'Lee', new: 'x' }]);
    expect(Object.keys(values.readRecord(only.items[0]))).toEqual(['id', 'last', 'new']);
    const except = await setFields({ list: [people[0]], keep_existing_fields: 'except', keep_options: { fields: 'meta, age' } });
    expect(except.items).toEqual([{ id: 1, first: 'Ann', last: 'Lee' }]);
    const none = await setFields({
      list: [people[0]],
      keep_existing_fields: 'none',
      set_fields: [{ field: 'name.first', value_from: 'field', value: 'first' }],
    });
    expect(none.items).toEqual([{ name: { first: 'Ann' } }]);
  });

  test('setting a nested path creates the missing objects and keeps existing ones in place', async () => {
    const out = await setFields({
      list: [{ a: { b: 1 }, z: 0 }],
      set_fields: [
        { field: 'a.c', value_from: 'fixed', value: '2', type: 'number' },
        { field: 'x.y.z', value_from: 'fixed', value: 'deep' },
      ],
    });
    expect(out.items).toEqual([{ a: { b: 1, c: 2 }, z: 0, x: { y: { z: 'deep' } } }]);
  });

  test('does not change its input and accepts an empty list', async () => {
    const list = [{ a: 1 }];
    await setFields({ list, set_fields: [{ field: 'a', value_from: 'fixed', value: '2' }] });
    expect(list).toEqual([{ a: 1 }]);
    expect(await setFields({ list: [], set_fields: [{ field: 'a', value: '1' }] })).toEqual({ items: [], count: 0 });
  });

  test('templates replace plain paths and leave other braces alone', () => {
    expect(templates.render({ template: '{a.b}-{c.0}-{missing}-{ x }-{{a}}', entry: { a: { b: 1 }, c: ['z'] } })).toBe(
      '1-z--{ x }-{{"b":1}}',
    );
  });
});
