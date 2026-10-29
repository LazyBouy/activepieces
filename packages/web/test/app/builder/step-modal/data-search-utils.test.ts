import { describe, expect, it } from 'vitest';

import { dataSearchUtils } from '@/app/builder/step-modal/data-search-utils';
import { inputTreeKeys } from '@/app/builder/step-modal/input-tree-keys';
import { SchemaNode } from '@/app/builder/step-modal/schema-view-utils';

describe('dataSearchUtils.pruneData', () => {
  const data = {
    customer: { name: 'Ada Lovelace', email: 'ada@example.com' },
    order: { id: 42, items: [{ sku: 'A-1' }, { sku: 'B-2' }] },
    paid: true,
  };

  it('keeps everything when the query is empty or blank', () => {
    expect(dataSearchUtils.pruneData({ value: data, query: '   ' })).toEqual({
      matched: true,
      value: data,
    });
    expect(dataSearchUtils.isActive('  ')).toBe(false);
    expect(dataSearchUtils.isActive(' x ')).toBe(true);
  });

  it('keeps a matching key with its whole value, and the path down to it', () => {
    expect(
      dataSearchUtils.pruneData({ value: data, query: 'Customer' }),
    ).toEqual({
      matched: true,
      value: { customer: data.customer },
    });
  });

  it('keeps matching values, case-insensitively, with their ancestors', () => {
    expect(
      dataSearchUtils.pruneData({ value: data, query: 'lovelace' }),
    ).toEqual({
      matched: true,
      value: { customer: { name: 'Ada Lovelace' } },
    });
    expect(dataSearchUtils.pruneData({ value: data, query: '42' })).toEqual({
      matched: true,
      value: { order: { id: 42 } },
    });
  });

  it('keeps only the matching items of an array', () => {
    expect(dataSearchUtils.pruneData({ value: data, query: 'b-2' })).toEqual({
      matched: true,
      value: { order: { items: [{ sku: 'B-2' }] } },
    });
  });

  it('reports no match', () => {
    expect(
      dataSearchUtils.pruneData({ value: data, query: 'nothing' }).matched,
    ).toBe(false);
  });
});

describe('dataSearchUtils.filterSchemaNodes', () => {
  const nodes: SchemaNode[] = [
    group({
      id: 'customer',
      label: 'customer',
      children: [
        field({ id: 'customer/name', label: 'name', value: 'Ada Lovelace' }),
        field({
          id: 'customer/email',
          label: 'email',
          value: 'ada@example.com',
        }),
      ],
    }),
    field({ id: 'paid', label: 'paid', value: true }),
  ];

  it('returns the nodes unchanged for an empty query', () => {
    expect(dataSearchUtils.filterSchemaNodes({ nodes, query: '' })).toBe(nodes);
  });

  it('keeps a field whose label matches, with all of its children', () => {
    const [customer] = nodes;
    const labelled: SchemaNode = { ...customer, kind: 'field', value: {} };
    expect(
      dataSearchUtils.filterSchemaNodes({ nodes: [labelled], query: 'cust' }),
    ).toEqual([labelled]);
  });

  it('keeps a leaf whose value matches, under its ancestors', () => {
    const result = dataSearchUtils.filterSchemaNodes({
      nodes,
      query: 'example.com',
    });
    expect(result.map((node) => node.id)).toEqual(['customer']);
    expect(result[0].children.map((node) => node.id)).toEqual([
      'customer/email',
    ]);
  });

  it('drops branches with no match', () => {
    expect(dataSearchUtils.filterSchemaNodes({ nodes, query: 'zzz' })).toEqual(
      [],
    );
  });
});

describe('inputTreeKeys.nextRowIndex', () => {
  it('moves one row and stops at both ends', () => {
    expect(
      inputTreeKeys.nextRowIndex({ count: 3, currentIndex: 0, step: 1 }),
    ).toBe(1);
    expect(
      inputTreeKeys.nextRowIndex({ count: 3, currentIndex: 2, step: 1 }),
    ).toBe(2);
    expect(
      inputTreeKeys.nextRowIndex({ count: 3, currentIndex: 0, step: -1 }),
    ).toBe(0);
  });

  it('does nothing when the focus is not on a row', () => {
    expect(
      inputTreeKeys.nextRowIndex({ count: 3, currentIndex: -1, step: 1 }),
    ).toBe(-1);
    expect(
      inputTreeKeys.nextRowIndex({ count: 0, currentIndex: -1, step: 1 }),
    ).toBe(-1);
  });
});

function field({
  id,
  label,
  value,
}: {
  id: string;
  label: string;
  value: unknown;
}): SchemaNode {
  return {
    id,
    kind: 'field',
    label,
    value,
    path: null,
    tone: 'default',
    children: [],
  };
}

function group({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: SchemaNode[];
}): SchemaNode {
  return {
    id,
    kind: 'group',
    label,
    value: undefined,
    path: null,
    tone: 'default',
    children,
  };
}
