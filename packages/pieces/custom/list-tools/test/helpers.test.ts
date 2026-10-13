/// <reference types="vitest/globals" />

import { compare } from '../src/lib/common/compare';
import { conditions } from '../src/lib/common/conditions';
import { equality } from '../src/lib/common/equality';
import { lists } from '../src/lib/common/lists';
import { paths } from '../src/lib/common/paths';
import { seenStore } from '../src/lib/common/seen-store';
import { values } from '../src/lib/common/values';

describe('paths', () => {
  test('parses dotted paths and comma lists', () => {
    expect(paths.parse(' customer.address.city ')).toEqual(['customer', 'address', 'city']);
    expect(paths.parse('')).toEqual([]);
    expect(paths.parseList('a, b.c ,, d')).toEqual([['a'], ['b', 'c'], ['d']]);
    expect(paths.toName('customer.address.city')).toBe('customer_address_city');
  });

  test('reads nested fields and list positions counting from 0', () => {
    const order = { customer: { address: { city: 'Lyon' } }, lines: [{ sku: 'A' }, { sku: 'B' }] };
    expect(paths.read({ value: order, path: paths.parse('customer.address.city') })).toBe('Lyon');
    expect(paths.read({ value: order, path: paths.parse('lines.1.sku') })).toBe('B');
    expect(paths.read({ value: order, path: paths.parse('lines.5.sku') })).toBeUndefined();
    expect(paths.read({ value: order, path: paths.parse('customer.missing.deep') })).toBeUndefined();
    expect(paths.read({ value: order, path: [] })).toBe(order);
  });

  test('does not read inherited object properties', () => {
    expect(paths.read({ value: {}, path: ['constructor'] })).toBeUndefined();
    expect(paths.read({ value: { a: 1 }, path: ['toString'] })).toBeUndefined();
  });

  test('a key with a dot is not reachable through a dotted path', () => {
    expect(paths.read({ value: { 'a.b': 1 }, path: paths.parse('a.b') })).toBeUndefined();
  });

  test('writes immutably, keeps positions and creates missing objects', () => {
    const source = { a: 1, b: { c: 2 } };
    const written = paths.write({ target: source, path: ['a'], value: 9 });
    expect(written).toEqual({ a: 9, b: { c: 2 } });
    expect(Object.keys(values.readRecord(written))).toEqual(['a', 'b']);
    expect(source).toEqual({ a: 1, b: { c: 2 } });
    expect(paths.write({ target: source, path: ['x', 'y', 'z'], value: true })).toEqual({
      a: 1,
      b: { c: 2 },
      x: { y: { z: true } },
    });
    expect(paths.write({ target: { list: [1, 2] }, path: ['list', '1'], value: 5 })).toEqual({ list: [1, 5] });
  });

  test('keeps a __proto__ key as a plain field', () => {
    const written = paths.write({ target: {}, path: ['__proto__'], value: { polluted: true } });
    expect(Object.prototype.hasOwnProperty.call(written, '__proto__')).toBe(true);
    const probe: Record<string, unknown> = {};
    expect(probe['polluted']).toBeUndefined();
  });

  test('removes nested fields and list positions', () => {
    const source = { a: 1, b: { c: 2, d: 3 }, list: ['x', 'y'] };
    expect(paths.remove({ target: source, path: ['b', 'c'] })).toEqual({ a: 1, b: { d: 3 }, list: ['x', 'y'] });
    expect(paths.remove({ target: source, path: ['b'] })).toEqual({ a: 1, list: ['x', 'y'] });
    expect(paths.remove({ target: source, path: ['list', '0'] })).toEqual({ a: 1, b: { c: 2, d: 3 }, list: ['y'] });
    expect(paths.remove({ target: source, path: ['nope'] })).toBe(source);
  });

  test('picks fields in their original order', () => {
    const source = { z: 1, a: { keep: 1, drop: 2 }, m: 3 };
    expect(paths.pick({ source, paths: [['m'], ['a', 'keep'], ['z']] })).toEqual({ z: 1, a: { keep: 1 }, m: 3 });
    expect(Object.keys(paths.pick({ source, paths: [['m'], ['z']] }))).toEqual(['z', 'm']);
  });
});

describe('values', () => {
  test('empty means missing, null, empty text, empty list or empty object', () => {
    expect([undefined, null, '', [], {}].map(values.isEmpty)).toEqual([true, true, true, true, true]);
    expect([' ', 0, false, [0], { a: 1 }].map(values.isEmpty)).toEqual([false, false, false, false, false]);
  });

  test('numbers are numbers or plain decimal text after trimming', () => {
    expect(values.toNumber(' 7 ')).toBe(7);
    expect(values.toNumber('-0.5')).toBe(-0.5);
    expect(values.toNumber('1e3')).toBe(1000);
    expect(values.toNumber(12)).toBe(12);
    expect(values.toNumber('7a')).toBeNull();
    expect(values.toNumber('')).toBeNull();
    expect(values.toNumber('0x10')).toBeNull();
    expect(values.toNumber(true)).toBeNull();
    expect(values.toNumber(null)).toBeNull();
  });

  test('dates are ISO text or milliseconds since 1970', () => {
    expect(values.toDate('2024-03-01')).toBe(Date.UTC(2024, 2, 1));
    expect(values.toDate('2024-03-01T10:30:00Z')).toBe(Date.UTC(2024, 2, 1, 10, 30));
    expect(values.toDate('2024-03-01T10:30:00.250+02:00')).toBe(Date.UTC(2024, 2, 1, 8, 30, 0, 250));
    expect(values.toDate(86400000)).toBe(86400000);
    expect(values.toDate('2023-02-29')).toBeNull();
    expect(values.toDate('yesterday')).toBeNull();
    expect(values.toDate({})).toBeNull();
  });

  test('booleans read true/false in any case and 1/0', () => {
    expect(['TRUE', 'false', 1, 0, '1', true].map(values.toBoolean)).toEqual([true, false, true, false, true, true]);
    expect(values.toBoolean('yes')).toBeNull();
  });

  test('text reads numbers and booleans as text and never objects', () => {
    expect(values.toText(5)).toBe('5');
    expect(values.toText(false)).toBe('false');
    expect(values.toText({ a: 1 })).toBeNull();
    expect(values.toText([1])).toBeNull();
  });

  test('chooses a listed option, falls back when empty and refuses unknown ones', () => {
    const allowed = ['a', 'b'] as const;
    expect(values.chooseOption({ value: 'b', allowed, fallback: 'a', label: 'X' })).toBe('b');
    expect(values.chooseOption({ value: undefined, allowed, fallback: 'a', label: 'X' })).toBe('a');
    expect(() => values.chooseOption({ value: 'c', allowed, fallback: 'a', label: 'X' })).toThrow(
      'Choose one of the listed options for "X".',
    );
  });
});

describe('lists', () => {
  test('accepts a list or JSON text that parses to a list', () => {
    expect(lists.readList({ value: [1, 2], label: 'List' })).toEqual([1, 2]);
    expect(lists.readList({ value: ' [{"a":1}] ', label: 'List' })).toEqual([{ a: 1 }]);
  });

  test.each([{ a: 1 }, '{"a":1}', 'text', 5, null, undefined, '[not json'])('refuses %j', (value) => {
    expect(() => lists.readList({ value, label: 'List' })).toThrow(
      'The List input must be a list (for example a step output that is a list, or JSON text starting with [).',
    );
  });

  test('names the position of an entry that is not an object, counting from 1', () => {
    expect(() => lists.readObjects({ value: [{ a: 1 }, { b: 2 }, 'x'], label: 'List' })).toThrow(
      'Entry 3 of the List input is not an object. This action needs a list of objects.',
    );
  });
});

describe('equality', () => {
  const exact = equality.EXACT;
  test('is deep and ignores object key order', () => {
    expect(equality.areEqual({ first: { a: 1, b: [1, { c: 2 }] }, second: { b: [1, { c: 2 }], a: 1 }, options: exact })).toBe(true);
    expect(equality.areEqual({ first: [1, 2], second: [2, 1], options: exact })).toBe(false);
  });

  test('1 and "1" differ unless numeric text counts as a number', () => {
    expect(equality.areEqual({ first: 1, second: '1', options: exact })).toBe(false);
    expect(equality.areEqual({ first: 1, second: ' 1 ', options: { caseSensitive: true, numbersAsText: true } })).toBe(true);
  });

  test('text follows the case option', () => {
    expect(equality.areEqual({ first: 'Ann', second: 'ann', options: exact })).toBe(false);
    expect(equality.areEqual({ first: 'Ann', second: 'ann', options: { caseSensitive: false, numbersAsText: false } })).toBe(true);
  });

  test('missing and null are different values', () => {
    expect(equality.areEqual({ first: undefined, second: null, options: exact })).toBe(false);
    expect(equality.areEqual({ first: undefined, second: undefined, options: exact })).toBe(true);
  });
});

describe('compare', () => {
  test('text uses natural order', () => {
    const sorted = compare.sortItems({
      items: ['item 10', 'item 2', 'item 1'],
      keys: [{ path: [], direction: 'ascending', compareAs: 'text' }],
      caseSensitive: false,
    });
    expect(sorted).toEqual(['item 1', 'item 2', 'item 10']);
  });

  test('automatic compares numbers when both are numbers, otherwise text', () => {
    const sorted = compare.sortItems({
      items: ['10', 9, 'b', 'a', 100],
      keys: [{ path: [], direction: 'ascending', compareAs: 'auto' }],
      caseSensitive: false,
    });
    expect(sorted).toEqual([9, '10', 100, 'a', 'b']);
  });

  test('a random shuffle keeps every entry', () => {
    const shuffled = compare.shuffle({ items: [1, 2, 3, 4, 5], random: () => 0 });
    expect([...shuffled].sort()).toEqual([1, 2, 3, 4, 5]);
    expect(shuffled).toEqual([2, 3, 4, 5, 1]);
  });
});

describe('conditions', () => {
  test('rows without a field are ignored, and at least one is needed', () => {
    expect(() => conditions.compileConditions({ rows: [{ field: '  ', operator: 'exists' }], caseSensitive: false })).toThrow(
      'Add at least one condition with a field.',
    );
    expect(conditions.compileConditions({ rows: [{ field: '' }, { field: 'a', operator: 'exists' }], caseSensitive: false })).toHaveLength(1);
  });

  test('an invalid pattern names its condition', () => {
    expect(() =>
      conditions.compileConditions({
        rows: [
          { field: 'a', operator: 'exists' },
          { field: 'b', operator: 'text_matches_pattern', value: '(' },
        ],
        caseSensitive: false,
      }),
    ).toThrow('The pattern in condition 2 is not a valid regular expression.');
  });

  test('operator labels follow the Router style, in the specified order', () => {
    expect(conditions.OPERATORS.map((operator) => operator.label)).toEqual([
      'Exists',
      'Does not exist',
      'Is empty',
      'Is not empty',
      'Exactly matches (Text)',
      'Does not exactly match (Text)',
      'Contains (Text)',
      'Does not contain (Text)',
      'Starts with (Text)',
      'Does not start with (Text)',
      'Ends with (Text)',
      'Does not end with (Text)',
      'Matches pattern (Text)',
      'Is equal to (Number)',
      'Is not equal to (Number)',
      'Is greater than (Number)',
      'Is greater than or equal to (Number)',
      'Is less than (Number)',
      'Is less than or equal to (Number)',
      'Is true (Boolean)',
      'Is false (Boolean)',
      'Before (Date/time)',
      'After (Date/time)',
      'Equals (Date/time)',
      'Contains (List)',
      'Does not contain (List)',
      'Is empty (List)',
      'Is not empty (List)',
      'Has length (List)',
    ]);
  });
});

describe('seen store pages', () => {
  test('splits long memories into pages under the store value limit', () => {
    const keys = Array.from({ length: 20000 }, (_, index) => JSON.stringify(`https://example.com/item/${index}/${'x'.repeat(20)}`));
    const pages = seenStore.splitIntoPages(keys);
    expect(pages.length).toBeGreaterThan(1);
    expect(pages.flat()).toEqual(keys);
    pages.forEach((page) => expect(Buffer.byteLength(JSON.stringify(page), 'utf8')).toBeLessThan(512 * 1024));
  });
});
