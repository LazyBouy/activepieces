import { createAction, InputPropertyMap, Property } from '@activepieces/pieces-framework';
import { compare, CompareAs, SortDirection, SortKey } from '../common/compare';
import { lists } from '../common/lists';
import { paths } from '../common/paths';
import { listProps } from '../common/props';
import { values } from '../common/values';
import { outputSchemas } from '../output-schemas';

export const sortListAction = createAction({
  audience: 'human',
  name: 'sort_list',
  classification: 'READ',
  displayName: 'Sort List',
  description: 'Sorts a list by fields, by the entries themselves, or in random order.',
  aiMetadata: {
    description:
      'Reorders a list by one or more fields (ascending or descending, compared automatically, as text with natural order, as numbers or as dates), by the entries themselves, or shuffles it. Missing values always go last and equal keys keep their input order. Read-only; the random order differs on every run.',
    idempotent: true,
  },
  props: {
    list: listProps.list({
      displayName: 'List',
      description: 'A list from an earlier step, or JSON text starting with [. Entries must be objects when sorting by fields.',
    }),
    sort_by: Property.StaticDropdown<SortBy, false>({
      displayName: 'Sort by',
      required: false,
      defaultValue: 'fields',
      options: {
        options: [
          { label: 'Fields', value: 'fields' },
          { label: 'The entries themselves', value: 'entries' },
          { label: 'Random order', value: 'random' },
        ],
      },
    }),
    sort_options: listProps.shownFor({
      displayName: 'Sort keys',
      refresher: 'sort_by',
      build: (sortBy): InputPropertyMap => {
        if (sortBy === 'random') {
          return {};
        }
        if (sortBy === 'entries') {
          return { direction: directionProperty() };
        }
        return { sort_keys: sortKeysProperty() };
      },
    }),
    case_sensitive: listProps.caseSensitive({
      defaultValue: false,
      description: 'On: capital letters sort apart from small letters. Applies to text comparisons.',
    }),
  },
  outputSchema: outputSchemas.items,
  async run(context) {
    const sortBy = values.chooseOption({
      value: context.propsValue.sort_by,
      allowed: SORT_BY_VALUES,
      fallback: 'fields',
      label: 'Sort by',
    });
    const caseSensitive = values.readFlag({ value: context.propsValue.case_sensitive, fallback: false });
    const options = values.readRecord(context.propsValue.sort_options);
    const sorted = sortBySetting({ sortBy, options, list: context.propsValue.list, caseSensitive });
    return {
      items: sorted,
      count: sorted.length,
    };
  },
});

function sortBySetting({
  sortBy,
  options,
  list,
  caseSensitive,
}: {
  sortBy: SortBy;
  options: Record<string, unknown>;
  list: unknown;
  caseSensitive: boolean;
}): unknown[] {
  switch (sortBy) {
    case 'random':
      return compare.shuffle({ items: lists.readList({ value: list, label: 'List' }), random: Math.random });
    case 'entries': {
      const direction = values.chooseOption({
        value: options['direction'],
        allowed: DIRECTIONS,
        fallback: 'ascending',
        label: 'Direction',
      });
      return compare.sortItems({
        items: lists.readList({ value: list, label: 'List' }),
        keys: [{ path: [], direction, compareAs: 'auto' }],
        caseSensitive,
      });
    }
    case 'fields': {
      const keys = readSortKeys(options['sort_keys']);
      return compare.sortItems({
        items: lists.readObjects({ value: list, label: 'List' }),
        keys,
        caseSensitive,
      });
    }
  }
}

function readSortKeys(rows: unknown): SortKey[] {
  const keys = values.readRows(rows).flatMap((row, index): SortKey[] => {
    const field = values.readText(row['field']).trim();
    if (field === '') {
      return [];
    }
    return [
      {
        path: paths.parse(field),
        direction: values.chooseOption({
          value: row['direction'],
          allowed: DIRECTIONS,
          fallback: 'ascending',
          label: `Direction in sort key ${index + 1}`,
        }),
        compareAs: values.chooseOption({
          value: row['compare_as'],
          allowed: COMPARE_AS_VALUES,
          fallback: 'auto',
          label: `Compare as in sort key ${index + 1}`,
        }),
      },
    ];
  });
  if (keys.length === 0) {
    throw new Error('Add at least one field to sort by.');
  }
  return keys;
}

function directionProperty() {
  return Property.StaticDropdown<SortDirection, false>({
    displayName: 'Direction',
    required: false,
    defaultValue: 'ascending',
    options: {
      options: DIRECTION_OPTIONS,
    },
  });
}

function sortKeysProperty() {
  return Property.Array({
    displayName: 'Sort keys',
    description: 'The first row is the main key; later rows break ties.',
    required: false,
    defaultValue: [{ field: '', direction: 'ascending', compare_as: 'auto' }],
    properties: {
      field: Property.ShortText({
        displayName: 'Field',
        description: 'A field name, or names joined by dots for nested fields.',
        required: false,
      }),
      direction: Property.StaticDropdown<SortDirection, false>({
        displayName: 'Direction',
        required: false,
        defaultValue: 'ascending',
        options: {
          options: DIRECTION_OPTIONS,
        },
      }),
      compare_as: Property.StaticDropdown<CompareAs, false>({
        displayName: 'Compare as',
        required: false,
        defaultValue: 'auto',
        options: {
          options: [
            { label: 'Automatic', value: 'auto' },
            { label: 'Text', value: 'text' },
            { label: 'Number', value: 'number' },
            { label: 'Date', value: 'date' },
          ],
        },
      }),
    },
  });
}

const DIRECTION_OPTIONS: { label: string; value: SortDirection }[] = [
  { label: 'Ascending', value: 'ascending' },
  { label: 'Descending', value: 'descending' },
];

const SORT_BY_VALUES: readonly SortBy[] = ['fields', 'entries', 'random'];
const DIRECTIONS: readonly SortDirection[] = ['ascending', 'descending'];
const COMPARE_AS_VALUES: readonly CompareAs[] = ['auto', 'text', 'number', 'date'];

type SortBy = 'fields' | 'entries' | 'random';
