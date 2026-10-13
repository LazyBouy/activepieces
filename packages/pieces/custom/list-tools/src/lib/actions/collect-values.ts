import { createAction, Property } from '@activepieces/pieces-framework';
import { equality } from '../common/equality';
import { lists } from '../common/lists';
import { paths } from '../common/paths';
import { listProps } from '../common/props';
import { values } from '../common/values';
import { outputSchemas } from '../output-schemas';

export const collectValuesAction = createAction({
  audience: 'human',
  name: 'collect_values',
  classification: 'READ',
  displayName: 'Collect Values',
  description: 'Gathers values from every entry into lists.',
  aiMetadata: {
    description:
      'Builds one list per chosen field from all entries of a list of objects (for example every email address), with options to flatten inner lists one level, keep missing values as null, and drop repeats. Use Group and Summarize instead for per-group lists and totals. Read-only and idempotent.',
    idempotent: true,
  },
  props: {
    list: listProps.list({
      displayName: 'List',
      description: 'A list of objects from an earlier step, or JSON text starting with [.',
    }),
    fields: Property.Array({
      displayName: 'Fields',
      description: 'One row per list to build.',
      required: true,
      defaultValue: [{ field: '', save_as: '' }],
      properties: {
        field: Property.ShortText({
          displayName: 'Field',
          description: 'A field name, or names joined by dots for nested fields.',
          required: false,
        }),
        save_as: Property.ShortText({
          displayName: 'Save as',
          description: 'The name of the output list. Empty: the field with dots replaced by underscores.',
          required: false,
        }),
      },
    }),
    flatten_lists: Property.Checkbox({
      displayName: 'Flatten lists',
      description: 'On: a value that is itself a list adds its entries, one level deep.',
      required: false,
      defaultValue: false,
    }),
    keep_empty_values: Property.Checkbox({
      displayName: 'Keep empty values',
      description: 'On: missing and null values are added as null.',
      required: false,
      defaultValue: false,
    }),
    unique_values_only: Property.Checkbox({
      displayName: 'Unique values only',
      description: 'On: repeated values are dropped, keeping the first.',
      required: false,
      defaultValue: false,
    }),
  },
  outputSchema: outputSchemas.collectValues,
  async run(context) {
    const rows = values.readRows(context.propsValue.fields).flatMap((row) => {
      const fieldText = values.readText(row['field']).trim();
      if (fieldText === '') {
        return [];
      }
      const saveAs = values.readText(row['save_as']).trim();
      return [{ path: paths.parse(fieldText), name: saveAs === '' ? paths.toName(fieldText) : saveAs }];
    });
    if (rows.length === 0) {
      throw new Error('Add at least one field to collect.');
    }
    if (new Set(rows.map((row) => row.name)).size !== rows.length) {
      throw new Error('Each field must be saved under a different name.');
    }
    const flatten = values.readFlag({ value: context.propsValue.flatten_lists, fallback: false });
    const keepEmpty = values.readFlag({ value: context.propsValue.keep_empty_values, fallback: false });
    const uniqueOnly = values.readFlag({ value: context.propsValue.unique_values_only, fallback: false });
    const entries = lists.readObjects({ value: context.propsValue.list, label: 'List' });
    return Object.fromEntries(
      rows.map((row) => {
        const collected = entries.flatMap((entry) =>
          valuesOf({ value: paths.read({ value: entry, path: row.path }), flatten, keepEmpty }),
        );
        return [row.name, uniqueOnly ? uniqueValues(collected) : collected];
      }),
    );
  },
});

function valuesOf({ value, flatten, keepEmpty }: { value: unknown; flatten: boolean; keepEmpty: boolean }): unknown[] {
  const found = flatten && Array.isArray(value) ? value : [value];
  return found.flatMap((item) => {
    if (values.isMissing(item)) {
      return keepEmpty ? [null] : [];
    }
    return [item];
  });
}

function uniqueValues(collected: unknown[]): unknown[] {
  const seen = new Set<string>();
  return collected.filter((value) => {
    const key = equality.canonical({ value, options: equality.EXACT });
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
