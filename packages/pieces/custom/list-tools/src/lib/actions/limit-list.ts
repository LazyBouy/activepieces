import { createAction, Property } from '@activepieces/pieces-framework';
import { lists } from '../common/lists';
import { listProps } from '../common/props';
import { values } from '../common/values';
import { outputSchemas } from '../output-schemas';

export const limitListAction = createAction({
  audience: 'human',
  name: 'limit_list',
  classification: 'READ',
  displayName: 'Limit List',
  description: 'Keeps the first or last entries of a list, up to the number you choose.',
  aiMetadata: {
    description:
      'Returns at most a given number of entries from the start or the end of a list, in their original order, and reports how many were left out. Use it to cap a list before looping over it; sort first with Sort List to keep the top or bottom entries. Read-only and idempotent.',
    idempotent: true,
  },
  props: {
    list: listProps.list({
      displayName: 'List',
      description: 'A list from an earlier step, or JSON text starting with [. Entries can be anything.',
    }),
    how_many: Property.Number({
      displayName: 'How many',
      description: 'The most entries to keep. 0 returns an empty list.',
      required: true,
      defaultValue: 10,
    }),
    keep: Property.StaticDropdown<KeepFrom, false>({
      displayName: 'Keep',
      required: false,
      defaultValue: 'first',
      options: {
        options: [
          { label: 'The first entries', value: 'first' },
          { label: 'The last entries', value: 'last' },
        ],
      },
    }),
  },
  outputSchema: outputSchemas.itemsWithRemovedCount,
  async run(context) {
    const howMany = values.toNumber(context.propsValue.how_many);
    if (howMany === null || !Number.isInteger(howMany) || howMany < 0) {
      throw new Error('How many must be a whole number of 0 or more.');
    }
    const keep = values.chooseOption({
      value: context.propsValue.keep,
      allowed: KEEP_FROM_VALUES,
      fallback: 'first',
      label: 'Keep',
    });
    const items = lists.readList({ value: context.propsValue.list, label: 'List' });
    const limited =
      keep === 'first' ? items.slice(0, howMany) : items.slice(Math.max(items.length - howMany, 0));
    return {
      items: limited,
      count: limited.length,
      removedCount: items.length - limited.length,
    };
  },
});

const KEEP_FROM_VALUES: readonly KeepFrom[] = ['first', 'last'];

type KeepFrom = 'first' | 'last';
