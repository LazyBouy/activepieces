import { createAction, InputPropertyMap, Property } from '@activepieces/pieces-framework';
import { lists } from '../common/lists';
import { paths } from '../common/paths';
import { listProps } from '../common/props';
import { templates } from '../common/templates';
import { values } from '../common/values';
import { outputSchemas } from '../output-schemas';

export const setFieldsAction = createAction({
  audience: 'human',
  name: 'set_fields',
  classification: 'READ',
  displayName: 'Set Fields',
  description: 'Sets, copies or removes fields on every entry.',
  aiMetadata: {
    description:
      'Rewrites every object in a list: sets fields to a fixed value, to another field of the same entry or to a text template such as {first} {last}, converts them to text, number, true/false, list or object, and keeps all, some or none of the existing fields. Use Rename Fields to only change names. Read-only and idempotent.',
    idempotent: true,
  },
  props: {
    list: listProps.list({
      displayName: 'List',
      description: 'A list of objects from an earlier step, or JSON text starting with [.',
    }),
    set_fields: Property.Array({
      displayName: 'Set fields',
      description: 'Each row sets one field on every entry. Nested paths create the missing objects.',
      required: false,
      properties: {
        field: Property.ShortText({
          displayName: 'Field',
          description: 'The field to set, such as status or customer.name.',
          required: false,
        }),
        value_from: Property.StaticDropdown<ValueFrom, false>({
          displayName: 'Value from',
          required: false,
          defaultValue: 'fixed',
          options: {
            options: [
              { label: 'A fixed value', value: 'fixed' },
              { label: 'Another field of the entry', value: 'field' },
              { label: 'A text template', value: 'template' },
            ],
          },
        }),
        value: Property.ShortText({
          displayName: 'Value',
          description:
            'A fixed value, the name of another field, or a template where {field} is replaced by that field of the entry.',
          required: false,
        }),
        type: Property.StaticDropdown<ValueType, false>({
          displayName: 'Type',
          required: false,
          defaultValue: 'keep',
          options: {
            options: [
              { label: 'Keep as is', value: 'keep' },
              { label: 'Text', value: 'text' },
              { label: 'Number', value: 'number' },
              { label: 'True or false', value: 'boolean' },
              { label: 'List', value: 'list' },
              { label: 'Object', value: 'object' },
            ],
          },
        }),
      },
    }),
    keep_existing_fields: Property.StaticDropdown<KeepExisting, false>({
      displayName: 'Keep existing fields',
      required: false,
      defaultValue: 'all',
      options: {
        options: [
          { label: 'All', value: 'all' },
          { label: 'Only these', value: 'only' },
          { label: 'All except', value: 'except' },
          { label: 'None', value: 'none' },
        ],
      },
    }),
    keep_options: listProps.shownFor({
      displayName: 'Fields',
      refresher: 'keep_existing_fields',
      build: (keepExisting): InputPropertyMap =>
        keepExisting === 'only' || keepExisting === 'except'
          ? {
              fields: Property.ShortText({
                displayName: 'Fields',
                description: 'Field names separated by commas. Use dots for nested fields.',
                required: false,
              }),
            }
          : {},
    }),
    stop_on_conversion_errors: Property.Checkbox({
      displayName: 'Stop on conversion errors',
      description: 'Off: a value that cannot be converted is kept as it was.',
      required: false,
      defaultValue: true,
    }),
  },
  outputSchema: outputSchemas.items,
  async run(context) {
    const rows = readSetRows(values.readRows(context.propsValue.set_fields));
    const keepExisting = values.chooseOption({
      value: context.propsValue.keep_existing_fields,
      allowed: KEEP_EXISTING_VALUES,
      fallback: 'all',
      label: 'Keep existing fields',
    });
    const keepPaths =
      keepExisting === 'only' || keepExisting === 'except'
        ? paths.parseList(values.readText(values.readRecord(context.propsValue.keep_options)['fields']))
        : [];
    const stopOnErrors = values.readFlag({ value: context.propsValue.stop_on_conversion_errors, fallback: true });
    const entries = lists.readObjects({ value: context.propsValue.list, label: 'List' });
    const updated = entries.map((entry, index) =>
      rows.reduce<unknown>(
        (current, row) =>
          paths.write({
            target: current,
            path: row.path,
            value: resolveValue({ row, entry, position: index + 1, stopOnErrors }),
          }),
        keptFields({ entry, keepExisting, keepPaths }),
      ),
    );
    return {
      items: updated,
      count: updated.length,
    };
  },
});

function readSetRows(rows: Record<string, unknown>[]): SetRow[] {
  return rows.flatMap((row, index) => {
    const fieldText = values.readText(row['field']).trim();
    if (fieldText === '') {
      return [];
    }
    return [
      {
        fieldText,
        path: paths.parse(fieldText),
        valueFrom: values.chooseOption({
          value: row['value_from'],
          allowed: VALUE_FROM_VALUES,
          fallback: 'fixed',
          label: `Value from in row ${index + 1}`,
        }),
        rawValue: row['value'],
        type: values.chooseOption({
          value: row['type'],
          allowed: VALUE_TYPE_VALUES,
          fallback: 'keep',
          label: `Type in row ${index + 1}`,
        }),
      },
    ];
  });
}

function keptFields({
  entry,
  keepExisting,
  keepPaths,
}: {
  entry: Record<string, unknown>;
  keepExisting: KeepExisting;
  keepPaths: string[][];
}): unknown {
  switch (keepExisting) {
    case 'all':
      return entry;
    case 'only':
      return paths.pick({ source: entry, paths: keepPaths });
    case 'except':
      return paths.removeAll({ target: entry, paths: keepPaths });
    case 'none':
      return {};
  }
}

function resolveValue({
  row,
  entry,
  position,
  stopOnErrors,
}: {
  row: SetRow;
  entry: Record<string, unknown>;
  position: number;
  stopOnErrors: boolean;
}): unknown {
  const source = sourceValue({ row, entry });
  const converted = convert({ value: source, type: row.type });
  if (converted.ok) {
    return converted.value;
  }
  if (stopOnErrors) {
    throw new Error(`Entry ${position}: ${row.fieldText} cannot be converted to ${TYPE_NAMES[row.type]}.`);
  }
  return source;
}

function sourceValue({ row, entry }: { row: SetRow; entry: Record<string, unknown> }): unknown {
  switch (row.valueFrom) {
    case 'fixed':
      return row.rawValue === undefined || row.rawValue === null ? '' : row.rawValue;
    case 'field':
      return paths.read({ value: entry, path: paths.parse(values.toDisplayText(row.rawValue)) });
    case 'template':
      return templates.render({ template: values.toDisplayText(row.rawValue), entry });
  }
}

function convert({ value, type }: { value: unknown; type: ValueType }): Conversion {
  switch (type) {
    case 'keep':
      return { ok: true, value };
    case 'text':
      return { ok: true, value: values.toDisplayText(value) };
    case 'number': {
      const asNumber = values.toNumber(value);
      return asNumber === null ? { ok: false } : { ok: true, value: asNumber };
    }
    case 'boolean': {
      const asBoolean = values.toBoolean(value);
      return asBoolean === null ? { ok: false } : { ok: true, value: asBoolean };
    }
    case 'list': {
      const parsed = typeof value === 'string' ? lists.parseJson(value) : value;
      return Array.isArray(parsed) ? { ok: true, value: parsed } : { ok: false };
    }
    case 'object': {
      const parsed = typeof value === 'string' ? lists.parseJson(value) : value;
      return values.isRecord(parsed) ? { ok: true, value: parsed } : { ok: false };
    }
  }
}

const KEEP_EXISTING_VALUES: readonly KeepExisting[] = ['all', 'only', 'except', 'none'];
const VALUE_FROM_VALUES: readonly ValueFrom[] = ['fixed', 'field', 'template'];
const VALUE_TYPE_VALUES: readonly ValueType[] = ['keep', 'text', 'number', 'boolean', 'list', 'object'];

const TYPE_NAMES: Record<ValueType, string> = {
  keep: 'its own type',
  text: 'text',
  number: 'a number',
  boolean: 'true or false',
  list: 'a list',
  object: 'an object',
};

type KeepExisting = 'all' | 'only' | 'except' | 'none';
type ValueFrom = 'fixed' | 'field' | 'template';
type ValueType = 'keep' | 'text' | 'number' | 'boolean' | 'list' | 'object';

type SetRow = {
  fieldText: string;
  path: string[];
  valueFrom: ValueFrom;
  rawValue: unknown;
  type: ValueType;
};

type Conversion = { ok: true; value: unknown } | { ok: false };
