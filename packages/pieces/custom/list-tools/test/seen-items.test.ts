/// <reference types="vitest/globals" />

import { createMockActionContext, Store, StoreScope } from '@activepieces/pieces-framework';
import { forgetSeenItemsAction } from '../src/lib/actions/forget-seen-items';
import { keepNewItemsAction } from '../src/lib/actions/keep-new-items';
import { seenStore } from '../src/lib/common/seen-store';
import { testUtils } from './test-utils';

const keepNew = ({ store, propsValue }: { store: Store; propsValue: Record<string, unknown> }) =>
  keepNewItemsAction.run({ ...createMockActionContext({ propsValue }), store });
const forget = ({ store, propsValue }: { store: Store; propsValue: Record<string, unknown> }) =>
  forgetSeenItemsAction.run({ ...createMockActionContext({ propsValue }), store });

describe('Keep New Items', () => {
  test('a second run skips the keys the first run let through', async () => {
    const { store } = testUtils.createMemoryStore();
    const first = await keepNew({ store, propsValue: { list: [{ id: 1 }, { id: 2 }], key_field: 'id' } });
    expect(first).toEqual({ items: [{ id: 1 }, { id: 2 }], count: 2, skipped: [], skippedCount: 0 });
    const second = await keepNew({ store, propsValue: { list: [{ id: 2 }, { id: 3 }], key_field: 'id' } });
    expect(second).toEqual({ items: [{ id: 3 }], count: 1, skipped: [{ id: 2 }], skippedCount: 1 });
  });

  test('keys compare as JSON text, so 1 and "1" differ, and a repeat inside one run is kept once', async () => {
    const { store } = testUtils.createMemoryStore();
    const out = await keepNew({
      store,
      propsValue: { list: [{ id: 1 }, { id: '1' }, { id: 1, again: true }, { id: 'A' }, { id: 'a' }], key_field: 'id' },
    });
    expect(out.items).toEqual([{ id: 1 }, { id: '1' }, { id: 'A' }, { id: 'a' }]);
    expect(out.skipped).toEqual([{ id: 1, again: true }]);
  });

  test('entries whose key is missing are kept and not remembered', async () => {
    const { store } = testUtils.createMemoryStore();
    await keepNew({ store, propsValue: { list: [{ name: 'no id' }, { id: null }], key_field: 'id' } });
    const again = await keepNew({ store, propsValue: { list: [{ name: 'no id' }, { id: null }], key_field: 'id' } });
    expect(again.count).toBe(2);
    expect((await seenStore.load({ store, scope: StoreScope.FLOW, name: 'seen-items' })).keys).toEqual([]);
  });

  test('uses the entries themselves when the key field is empty, objects with key order ignored', async () => {
    const { store } = testUtils.createMemoryStore();
    await keepNew({ store, propsValue: { list: ['a', 7, { x: 1, y: 2 }] } });
    const out = await keepNew({ store, propsValue: { list: ['a', 'b', 7, '7', { y: 2, x: 1 }] } });
    expect(out.items).toEqual(['b', '7']);
  });

  test('nested key paths', async () => {
    const { store } = testUtils.createMemoryStore();
    await keepNew({ store, propsValue: { list: [{ c: { email: 'a@x' } }], key_field: 'c.email' } });
    const out = await keepNew({ store, propsValue: { list: [{ c: { email: 'a@x' } }, { c: { email: 'b@x' } }], key_field: 'c.email' } });
    expect(out.items).toEqual([{ c: { email: 'b@x' } }]);
  });

  test('memories are separated by name and by scope', async () => {
    const { store } = testUtils.createMemoryStore();
    await keepNew({ store, propsValue: { list: [1], memory_name: 'orders' } });
    expect((await keepNew({ store, propsValue: { list: [1], memory_name: 'invoices' } })).count).toBe(1);
    expect((await keepNew({ store, propsValue: { list: [1], memory_name: 'orders', remember_for: 'project' } })).count).toBe(1);
    expect((await keepNew({ store, propsValue: { list: [1], memory_name: 'orders' } })).count).toBe(0);
    expect((await keepNew({ store, propsValue: { list: [1], memory_name: 'orders', remember_for: 'project' } })).count).toBe(0);
  });

  test('keeps at most Memory size keys, forgetting the oldest first', async () => {
    const { store } = testUtils.createMemoryStore();
    await keepNew({ store, propsValue: { list: [1, 2, 3], memory_size: 3 } });
    await keepNew({ store, propsValue: { list: [4, 5], memory_size: 3 } });
    expect((await seenStore.load({ store, scope: StoreScope.FLOW, name: 'seen-items' })).keys).toEqual(['3', '4', '5']);
    expect((await keepNew({ store, propsValue: { list: [1, 2, 3, 5], memory_size: 3 } })).items).toEqual([1, 2]);
  });

  test('a large memory is stored in several pages, read back whole, and capped at the default 10000 keys', async () => {
    const { store, entries } = testUtils.createMemoryStore();
    const list = Array.from({ length: 12000 }, (_, index) => `https://example.com/orders/${index}/${'x'.repeat(30)}`);
    await keepNew({ store, propsValue: { list } });
    const pageKeys = [...entries.keys()].filter((key) => key.includes('list-tools/seen/seen-items/'));
    expect(pageKeys.length).toBeGreaterThan(1);
    [...entries.values()].forEach((raw) => expect(Buffer.byteLength(raw, 'utf8')).toBeLessThan(512 * 1024));
    expect((await seenStore.load({ store, scope: StoreScope.FLOW, name: 'seen-items' })).keys).toHaveLength(10000);
    expect((await keepNew({ store, propsValue: { list: [list[11999], list[2000], list[1999], 'new'] } })).items).toEqual([
      list[1999],
      'new',
    ]);
  });

  test('the memory is not updated when the step fails', async () => {
    const { store, entries } = testUtils.createMemoryStore();
    await expect(keepNew({ store, propsValue: { list: { not: 'a list' } } })).rejects.toThrow('The List input must be a list');
    expect(entries.size).toBe(0);
  });

  test('stops on an invalid memory size or a long memory name', async () => {
    const { store } = testUtils.createMemoryStore();
    await expect(keepNew({ store, propsValue: { list: [1], memory_size: 0 } })).rejects.toThrow(
      'Memory size must be a whole number of 1 or more.',
    );
    await expect(keepNew({ store, propsValue: { list: [1], memory_name: 'x'.repeat(61) } })).rejects.toThrow(
      'Memory name can be at most 60 characters.',
    );
  });

  test('an empty list', async () => {
    const { store, entries } = testUtils.createMemoryStore();
    expect(await keepNew({ store, propsValue: { list: [] } })).toEqual({ items: [], count: 0, skipped: [], skippedCount: 0 });
    expect(entries.size).toBe(0);
  });
});

describe('Forget Seen Items', () => {
  test('forgets everything in the named memory', async () => {
    const { store, entries } = testUtils.createMemoryStore();
    await keepNew({ store, propsValue: { list: [1, 2, 3] } });
    expect(await forget({ store, propsValue: { forget: 'everything' } })).toEqual({ forgottenCount: 3 });
    expect(entries.size).toBe(0);
    expect((await keepNew({ store, propsValue: { list: [1] } })).count).toBe(1);
  });

  test('forgets only the listed keys, given as a list or JSON text', async () => {
    const { store } = testUtils.createMemoryStore();
    await keepNew({ store, propsValue: { list: [{ id: 1 }, { id: 'a' }, { id: 3 }], key_field: 'id' } });
    expect(await forget({ store, propsValue: { forget: 'keys', keys_options: { keys: [1, 'missing'] } } })).toEqual({
      forgottenCount: 1,
    });
    expect(await forget({ store, propsValue: { forget: 'keys', keys_options: { keys: '["a"]' } } })).toEqual({
      forgottenCount: 1,
    });
    const out = await keepNew({ store, propsValue: { list: [{ id: 1 }, { id: 'a' }, { id: 3 }], key_field: 'id' } });
    expect(out.items).toEqual([{ id: 1 }, { id: 'a' }]);
  });

  test('clearing a memory that does not exist is not an error', async () => {
    const { store } = testUtils.createMemoryStore();
    expect(await forget({ store, propsValue: { memory_name: 'never-used' } })).toEqual({ forgottenCount: 0 });
    expect(await forget({ store, propsValue: { forget: 'keys', keys_options: { keys: [1] } } })).toEqual({
      forgottenCount: 0,
    });
  });

  test('uses the same scope as Keep New Items', async () => {
    const { store } = testUtils.createMemoryStore();
    await keepNew({ store, propsValue: { list: [1], remember_for: 'project', memory_name: 'shared' } });
    expect(await forget({ store, propsValue: { memory_name: 'shared' } })).toEqual({ forgottenCount: 0 });
    expect(await forget({ store, propsValue: { memory_name: 'shared', remember_for: 'project' } })).toEqual({
      forgottenCount: 1,
    });
  });

  test('stops when Keys is not a list', async () => {
    const { store } = testUtils.createMemoryStore();
    await expect(forget({ store, propsValue: { forget: 'keys', keys_options: { keys: { a: 1 } } } })).rejects.toThrow(
      'The Keys input must be a list',
    );
  });
});
