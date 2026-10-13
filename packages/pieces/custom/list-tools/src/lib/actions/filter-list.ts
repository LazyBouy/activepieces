import { createAction, Property } from '@activepieces/pieces-framework';
import { conditions } from '../common/conditions';
import { lists } from '../common/lists';
import { listProps } from '../common/props';
import { values } from '../common/values';
import { outputSchemas } from '../output-schemas';

export const filterListAction = createAction({
  audience: 'human',
  name: 'filter_list',
  classification: 'READ',
  displayName: 'Filter List',
  description: 'Keeps the items that meet the conditions and returns the rest separately.',
  aiMetadata: {
    description:
      'Splits a list of objects into the entries that meet one or more field conditions (text, number, date, true/false, list and exists/empty checks, all or any) and the entries that do not. Pick it to narrow a list before looping or sending; use Remove Duplicates or Limit List for other trims. Entries must be objects; read-only and idempotent.',
    idempotent: true,
  },
  props: {
    list: listProps.list({
      displayName: 'List',
      description: 'A list of objects from an earlier step, or JSON text starting with [.',
    }),
    conditions: Property.Array({
      displayName: 'Conditions',
      description: 'Each row checks one field. Rows without a field are ignored.',
      required: true,
      defaultValue: [{ field: '', operator: 'text_exactly_matches', value: '' }],
      properties: {
        field: Property.ShortText({
          displayName: 'Field',
          description: 'A field name, or names joined by dots for nested fields (customer.address.city).',
          required: false,
        }),
        operator: Property.StaticDropdown({
          displayName: 'Operator',
          required: false,
          options: {
            options: conditions.OPERATORS.map((operator) => ({ label: operator.label, value: operator.value })),
          },
        }),
        value: Property.ShortText({
          displayName: 'Value',
          description: 'The value to compare with. Not used by Exists, Is empty, Is true and similar checks.',
          required: false,
        }),
      },
    }),
    match: Property.StaticDropdown<MatchMode, false>({
      displayName: 'Match',
      description: 'Whether an item must meet every condition or just one of them.',
      required: false,
      defaultValue: 'all',
      options: {
        options: [
          { label: 'All conditions', value: 'all' },
          { label: 'Any condition', value: 'any' },
        ],
      },
    }),
    case_sensitive: listProps.caseSensitive({
      defaultValue: false,
      description: 'On: "Paid" and "paid" are different. Applies to text conditions.',
    }),
  },
  outputSchema: outputSchemas.filterList,
  async run(context) {
    const caseSensitive = values.readFlag({ value: context.propsValue.case_sensitive, fallback: false });
    const compiled = conditions.compileConditions({
      rows: values.readRows(context.propsValue.conditions),
      caseSensitive,
    });
    const match = values.chooseOption({
      value: context.propsValue.match,
      allowed: MATCH_MODES,
      fallback: 'all',
      label: 'Match',
    });
    const items = lists.readObjects({ value: context.propsValue.list, label: 'List' });
    const matchAll = match === 'all';
    const verdicts = items.map((item) => conditions.matches({ item, conditions: compiled, matchAll }));
    const kept = items.filter((_, index) => verdicts[index]);
    const removed = items.filter((_, index) => !verdicts[index]);
    return {
      kept,
      removed,
      keptCount: kept.length,
      removedCount: removed.length,
    };
  },
});

const MATCH_MODES: readonly MatchMode[] = ['all', 'any'];

type MatchMode = 'all' | 'any';
