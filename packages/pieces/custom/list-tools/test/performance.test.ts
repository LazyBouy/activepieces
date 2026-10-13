/// <reference types="vitest/globals" />

import { createMockActionContext } from '@activepieces/pieces-framework';
import { collectValuesAction } from '../src/lib/actions/collect-values';
import { combineListsAction } from '../src/lib/actions/combine-lists';
import { compareListsAction } from '../src/lib/actions/compare-lists';
import { expandNestedListAction } from '../src/lib/actions/expand-nested-list';
import { filterListAction } from '../src/lib/actions/filter-list';
import { forgetSeenItemsAction } from '../src/lib/actions/forget-seen-items';
import { groupAndSummarizeAction } from '../src/lib/actions/group-and-summarize';
import { keepNewItemsAction } from '../src/lib/actions/keep-new-items';
import { limitListAction } from '../src/lib/actions/limit-list';
import { removeDuplicatesAction } from '../src/lib/actions/remove-duplicates';
import { renameFieldsAction } from '../src/lib/actions/rename-fields';
import { setFieldsAction } from '../src/lib/actions/set-fields';
import { sortListAction } from '../src/lib/actions/sort-list';
import { testUtils } from './test-utils';

const SIZE = 10000;
const LIMIT_MS = 1000;

const entries = testUtils.range(SIZE).map((index) => ({
  id: index,
  name: `Customer ${SIZE - index}`,
  email: `user${index % 7000}@example.com`,
  region: ['EU', 'US', 'APAC', 'LATAM'][index % 4],
  amount: (index * 37) % 1000,
  createdAt: new Date(Date.UTC(2024, 0, 1) + index * 3600000).toISOString(),
  active: index % 3 === 0,
  tags: [`t${index % 5}`, `t${index % 11}`],
  address: { city: `City ${index % 50}`, zip: `${10000 + index}` },
}));

async function timed(run: () => Promise<unknown>): Promise<number> {
  const started = performance.now();
  await run();
  return performance.now() - started;
}

const context = (propsValue: Record<string, unknown>) => createMockActionContext({ propsValue });
const byId = [{ field_in_first: 'id', field_in_second: 'id' }];

describe(`performance smoke tests with ${SIZE} entries`, () => {
  test('Filter List', async () => {
    const elapsed = await timed(() =>
      filterListAction.run(
        context({
          list: entries,
          conditions: [
            { field: 'amount', operator: 'number_greater', value: '500' },
            { field: 'name', operator: 'text_contains', value: 'customer 1' },
            { field: 'createdAt', operator: 'date_after', value: '2024-02-01' },
            { field: 'tags', operator: 'list_contains', value: 't3' },
          ],
          match: 'any',
        }),
      ),
    );
    expect(elapsed).toBeLessThan(LIMIT_MS);
  });

  test('Sort List', async () => {
    const elapsed = await timed(() =>
      sortListAction.run(
        context({
          list: entries,
          sort_options: {
            sort_keys: [
              { field: 'region', direction: 'ascending', compare_as: 'text' },
              { field: 'name', direction: 'descending', compare_as: 'auto' },
            ],
          },
        }),
      ),
    );
    expect(elapsed).toBeLessThan(LIMIT_MS);
  });

  test('Limit List', async () => {
    expect(await timed(() => limitListAction.run(context({ list: entries, how_many: 5000, keep: 'last' })))).toBeLessThan(
      LIMIT_MS,
    );
  });

  test('Remove Duplicates', async () => {
    const whole = await timed(() => removeDuplicatesAction.run(context({ list: entries })));
    const fields = await timed(() =>
      removeDuplicatesAction.run(context({ list: entries, compare: 'only', fields_options: { fields: 'email' }, keep: 'last' })),
    );
    expect(whole).toBeLessThan(LIMIT_MS);
    expect(fields).toBeLessThan(LIMIT_MS);
  });

  test('Keep New Items and Forget Seen Items', async () => {
    const { store } = testUtils.createMemoryStore();
    const keep = await timed(() =>
      keepNewItemsAction.run({ ...context({ list: entries, key_field: 'email' }), store }),
    );
    const again = await timed(() =>
      keepNewItemsAction.run({ ...context({ list: entries, key_field: 'email' }), store }),
    );
    const forget = await timed(() =>
      forgetSeenItemsAction.run({
        ...context({ forget: 'keys', keys_options: { keys: entries.map((entry) => entry.email) } }),
        store,
      }),
    );
    expect(keep).toBeLessThan(LIMIT_MS);
    expect(again).toBeLessThan(LIMIT_MS);
    expect(forget).toBeLessThan(LIMIT_MS);
  });

  test('Expand Nested List', async () => {
    expect(
      await timed(() => expandNestedListAction.run(context({ list: entries, field_to_expand: 'tags', put_each_element_in: 'tag' }))),
    ).toBeLessThan(LIMIT_MS);
  });

  test('Collect Values', async () => {
    expect(
      await timed(() =>
        collectValuesAction.run(
          context({
            list: entries,
            fields: [{ field: 'email' }, { field: 'address.city' }, { field: 'tags' }],
            flatten_lists: true,
            unique_values_only: true,
          }),
        ),
      ),
    ).toBeLessThan(LIMIT_MS);
  });

  test('Group and Summarize', async () => {
    expect(
      await timed(() =>
        groupAndSummarizeAction.run(
          context({
            list: entries,
            group_by: 'region, address.city',
            calculations: [
              { field: '', calculation: 'count' },
              { field: 'amount', calculation: 'sum' },
              { field: 'amount', calculation: 'average' },
              { field: 'email', calculation: 'count_unique' },
              { field: 'createdAt', calculation: 'maximum' },
              { field: 'name', calculation: 'join' },
            ],
          }),
        ),
      ),
    ).toBeLessThan(LIMIT_MS);
  });

  test('Compare Lists', async () => {
    const changed = entries.map((entry) => (entry.id % 10 === 0 ? { ...entry, amount: -1 } : entry));
    expect(
      await timed(() =>
        compareListsAction.run(
          context({ first_list: entries, second_list: changed.slice(500), match_on: byId, ignore_fields: 'createdAt' }),
        ),
      ),
    ).toBeLessThan(LIMIT_MS);
  });

  test('Combine Lists in every mode', async () => {
    const extra = entries.map((entry) => ({ id: entry.id, score: entry.amount * 2, address: { country: 'X' } }));
    const append = await timed(() => combineListsAction.run(context({ first_list: entries, second_list: extra })));
    const match = await timed(() =>
      combineListsAction.run(
        context({ first_list: entries, second_list: extra, how: 'match', how_options: { match_on: byId, keep: 'all_both' } }),
      ),
    );
    const position = await timed(() =>
      combineListsAction.run(context({ first_list: entries, second_list: extra, how: 'position' })),
    );
    const combination = await timed(() =>
      combineListsAction.run(
        context({ first_list: entries.slice(0, 100), second_list: extra.slice(0, 100), how: 'combination' }),
      ),
    );
    [append, match, position, combination].forEach((elapsed) => expect(elapsed).toBeLessThan(LIMIT_MS));
  });

  test('Rename Fields', async () => {
    expect(
      await timed(() =>
        renameFieldsAction.run(
          context({
            list: entries,
            renames: [
              { from: 'name', to: 'fullName' },
              { from: 'address.city', to: 'city' },
            ],
            pattern_renames: [{ pattern: '^(.)', replace_with: 'x_$1' }],
          }),
        ),
      ),
    ).toBeLessThan(LIMIT_MS);
  });

  test('Set Fields', async () => {
    expect(
      await timed(() =>
        setFieldsAction.run(
          context({
            list: entries,
            set_fields: [
              { field: 'label', value_from: 'template', value: '{name} <{email}> from {address.city}' },
              { field: 'amountText', value_from: 'field', value: 'amount', type: 'text' },
              { field: 'meta.flag', value_from: 'fixed', value: 'true', type: 'boolean' },
            ],
            keep_existing_fields: 'except',
            keep_options: { fields: 'tags' },
          }),
        ),
      ),
    ).toBeLessThan(LIMIT_MS);
  });
});
