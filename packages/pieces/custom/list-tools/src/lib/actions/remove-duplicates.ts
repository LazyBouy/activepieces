import { createAction, InputPropertyMap, Property } from '@activepieces/pieces-framework';
import { equality } from '../common/equality';
import { lists } from '../common/lists';
import { paths } from '../common/paths';
import { listProps } from '../common/props';
import { values } from '../common/values';
import { outputSchemas } from '../output-schemas';

export const removeDuplicatesAction = createAction({
  audience: 'human',
  name: 'remove_duplicates',
  classification: 'READ',
  displayName: 'Remove Duplicates',
  description: 'Removes repeated entries from a list, comparing whole entries or chosen fields.',
  aiMetadata: {
    description:
      'Drops entries that repeat earlier (or later) ones, comparing whole entries, only some fields, or all fields except some; objects compare deeply with key order ignored, and 1 differs from "1". Use Keep New Items instead to skip entries already seen in earlier runs. Read-only and idempotent.',
    idempotent: true,
  },
  props: {
    list: listProps.list({
      displayName: 'List',
      description: 'A list from an earlier step, or JSON text starting with [.',
    }),
    compare: Property.StaticDropdown<CompareMode, false>({
      displayName: 'Compare',
      description: 'What has to match for two entries to count as duplicates. The field options need entries that are objects.',
      required: false,
      defaultValue: 'whole',
      options: {
        options: [
          { label: 'Whole entries', value: 'whole' },
          { label: 'Only these fields', value: 'only' },
          { label: 'All fields except', value: 'except' },
        ],
      },
    }),
    fields_options: listProps.shownFor({
      displayName: 'Fields',
      refresher: 'compare',
      build: (compare): InputPropertyMap =>
        compare === 'only' || compare === 'except'
          ? {
              fields: Property.ShortText({
                displayName: 'Fields',
                description: 'Field names separated by commas. Use dots for nested fields (customer.email).',
                required: false,
              }),
            }
          : {},
    }),
    keep: Property.StaticDropdown<KeepOccurrence, false>({
      displayName: 'Keep',
      required: false,
      defaultValue: 'first',
      options: {
        options: [
          { label: 'The first occurrence', value: 'first' },
          { label: 'The last occurrence', value: 'last' },
        ],
      },
    }),
    output_options: listProps.shownFor({
      displayName: 'Output only the compared fields',
      refresher: 'compare',
      build: (compare): InputPropertyMap =>
        compare === 'only'
          ? {
              output_only_compared: Property.Checkbox({
                displayName: 'Output only the compared fields',
                description: 'On: each kept entry holds just the fields listed above.',
                required: false,
                defaultValue: false,
              }),
            }
          : {},
    }),
    case_sensitive: listProps.caseSensitive({
      defaultValue: true,
      description: 'Off: "Ann" and "ann" count as the same text.',
    }),
  },
  outputSchema: outputSchemas.itemsWithRemovedCount,
  async run(context) {
    const compareMode = values.chooseOption({
      value: context.propsValue.compare,
      allowed: COMPARE_MODES,
      fallback: 'whole',
      label: 'Compare',
    });
    const keep = values.chooseOption({
      value: context.propsValue.keep,
      allowed: KEEP_OCCURRENCES,
      fallback: 'first',
      label: 'Keep',
    });
    const caseSensitive = values.readFlag({ value: context.propsValue.case_sensitive, fallback: true });
    const fieldPaths =
      compareMode === 'whole'
        ? []
        : paths.parseList(values.readText(values.readRecord(context.propsValue.fields_options)['fields']));
    if (compareMode !== 'whole' && fieldPaths.length === 0) {
      throw new Error('List the fields to compare, separated by commas.');
    }
    const outputOnlyCompared =
      compareMode === 'only' &&
      values.readFlag({
        value: values.readRecord(context.propsValue.output_options)['output_only_compared'],
        fallback: false,
      });
    const items =
      compareMode === 'whole'
        ? lists.readList({ value: context.propsValue.list, label: 'List' })
        : lists.readObjects({ value: context.propsValue.list, label: 'List' });
    const options = { caseSensitive, numbersAsText: false };
    const keys = items.map((item) =>
      equality.canonical({ value: comparedValue({ item, compareMode, fieldPaths }), options }),
    );
    const keptIndexes = selectOccurrences({ keys, keep });
    const kept = items.filter((_, index) => keptIndexes.has(index));
    const output = outputOnlyCompared
      ? kept.map((item) => (values.isRecord(item) ? paths.pick({ source: item, paths: fieldPaths }) : item))
      : kept;
    return {
      items: output,
      count: output.length,
      removedCount: items.length - kept.length,
    };
  },
});

function comparedValue({
  item,
  compareMode,
  fieldPaths,
}: {
  item: unknown;
  compareMode: CompareMode;
  fieldPaths: string[][];
}): unknown {
  switch (compareMode) {
    case 'whole':
      return item;
    case 'only':
      return fieldPaths.map((path) => paths.read({ value: item, path }));
    case 'except':
      return paths.removeAll({ target: item, paths: fieldPaths });
  }
}

function selectOccurrences({ keys, keep }: { keys: string[]; keep: KeepOccurrence }): Set<number> {
  const chosen = keys.reduce((occurrences, key, index) => {
    if (keep === 'last' || !occurrences.has(key)) {
      occurrences.set(key, index);
    }
    return occurrences;
  }, new Map<string, number>());
  return new Set(chosen.values());
}

const COMPARE_MODES: readonly CompareMode[] = ['whole', 'only', 'except'];
const KEEP_OCCURRENCES: readonly KeepOccurrence[] = ['first', 'last'];

type CompareMode = 'whole' | 'only' | 'except';
type KeepOccurrence = 'first' | 'last';
