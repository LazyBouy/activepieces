import { createAction, InputPropertyMap, Property } from '@activepieces/pieces-framework';
import { lists } from '../common/lists';
import { paths } from '../common/paths';
import { listProps } from '../common/props';
import { values } from '../common/values';
import { outputSchemas } from '../output-schemas';

export const expandNestedListAction = createAction({
  audience: 'human',
  name: 'expand_nested_list',
  classification: 'READ',
  displayName: 'Expand Nested List',
  description: 'Turns a list held in a field of each entry into separate entries.',
  aiMetadata: {
    description:
      'Produces one output entry per element of a list stored in a field of each entry (for example one entry per order line), optionally keeping all, some or none of the other fields. A value that is not a list counts as one element; a missing or empty list produces no entries. Read-only and idempotent.',
    idempotent: true,
  },
  props: {
    list: listProps.list({
      displayName: 'List',
      description: 'A list of objects from an earlier step, or JSON text starting with [.',
    }),
    field_to_expand: Property.ShortText({
      displayName: 'Field to expand',
      description: 'The field that holds the inner list, such as lines or order.items.',
      required: true,
    }),
    keep_other_fields: Property.StaticDropdown<KeepOtherFields, false>({
      displayName: 'Keep other fields',
      description: 'Which fields of the original entry each new entry carries.',
      required: false,
      defaultValue: 'all',
      options: {
        options: [
          { label: 'No', value: 'no' },
          { label: 'All', value: 'all' },
          { label: 'Only these', value: 'only' },
        ],
      },
    }),
    keep_options: listProps.shownFor({
      displayName: 'Fields to keep',
      refresher: 'keep_other_fields',
      build: (keepOtherFields): InputPropertyMap =>
        keepOtherFields === 'only'
          ? {
              fields_to_keep: Property.ShortText({
                displayName: 'Fields to keep',
                description: 'Field names separated by commas. Use dots for nested fields.',
                required: false,
              }),
            }
          : {},
    }),
    put_each_element_in: Property.ShortText({
      displayName: 'Put each element in',
      description: 'The name of the field that receives each element. Empty: the last part of the expanded field.',
      required: false,
    }),
  },
  outputSchema: outputSchemas.items,
  async run(context) {
    const fieldText = values.readText(context.propsValue.field_to_expand).trim();
    if (fieldText === '') {
      throw new Error('Enter the field to expand.');
    }
    const fieldPath = paths.parse(fieldText);
    const keepOtherFields = values.chooseOption({
      value: context.propsValue.keep_other_fields,
      allowed: KEEP_OTHER_FIELDS_VALUES,
      fallback: 'all',
      label: 'Keep other fields',
    });
    const keepPaths =
      keepOtherFields === 'only'
        ? paths.parseList(values.readText(values.readRecord(context.propsValue.keep_options)['fields_to_keep']))
        : [];
    const targetText = values.readText(context.propsValue.put_each_element_in).trim();
    const targetPath = targetText === '' ? fieldPath.slice(-1) : paths.parse(targetText);
    const entries = lists.readObjects({ value: context.propsValue.list, label: 'List' });
    const expanded = entries.flatMap((entry) => {
      const nested = paths.read({ value: entry, path: fieldPath });
      if (values.isMissing(nested)) {
        return [];
      }
      const elements = Array.isArray(nested) ? nested : [nested];
      const base = baseEntry({ entry, keepOtherFields, keepPaths, fieldPath });
      return elements.map((element) => {
        if (base === null) {
          return values.isRecord(element) ? element : paths.write({ target: {}, path: targetPath, value: element });
        }
        return paths.write({ target: base, path: targetPath, value: element });
      });
    });
    return {
      items: expanded,
      count: expanded.length,
    };
  },
});

function baseEntry({
  entry,
  keepOtherFields,
  keepPaths,
  fieldPath,
}: {
  entry: Record<string, unknown>;
  keepOtherFields: KeepOtherFields;
  keepPaths: string[][];
  fieldPath: string[];
}): unknown {
  switch (keepOtherFields) {
    case 'no':
      return null;
    case 'all':
      return paths.remove({ target: entry, path: fieldPath });
    case 'only':
      return paths.remove({ target: paths.pick({ source: entry, paths: keepPaths }), path: fieldPath });
  }
}

const KEEP_OTHER_FIELDS_VALUES: readonly KeepOtherFields[] = ['no', 'all', 'only'];

type KeepOtherFields = 'no' | 'all' | 'only';
