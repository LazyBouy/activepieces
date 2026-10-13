import { createAction, Property } from '@activepieces/pieces-framework';
import { Calculation, calculations } from '../common/calculations';
import { equality } from '../common/equality';
import { lists } from '../common/lists';
import { paths } from '../common/paths';
import { listProps } from '../common/props';
import { values } from '../common/values';
import { outputSchemas } from '../output-schemas';

export const groupAndSummarizeAction = createAction({
  audience: 'human',
  name: 'group_and_summarize',
  classification: 'READ',
  displayName: 'Group and Summarize',
  description: 'Groups entries by fields and works out counts, sums, averages and more for each group.',
  aiMetadata: {
    description:
      'Groups a list of objects by one or more fields (or treats the whole list as one group) and computes count, count unique, sum, average, minimum, maximum, list of values, joined text, first or last value per group. Use it for totals per customer, status or day; use Collect Values for plain value lists. Read-only and idempotent.',
    idempotent: true,
  },
  props: {
    list: listProps.list({
      displayName: 'List',
      description: 'A list of objects from an earlier step, or JSON text starting with [.',
    }),
    group_by: Property.ShortText({
      displayName: 'Group by',
      description: 'Field names separated by commas. Empty: one summary over all entries.',
      required: false,
    }),
    calculations: Property.Array({
      displayName: 'Calculations',
      description: 'One row per value to work out. Count with an empty field counts the entries.',
      required: false,
      defaultValue: [{ field: '', calculation: 'count', save_as: '' }],
      properties: {
        field: Property.ShortText({
          displayName: 'Field',
          description: 'A field name, or names joined by dots for nested fields.',
          required: false,
        }),
        calculation: Property.StaticDropdown<Calculation, false>({
          displayName: 'Calculation',
          required: false,
          defaultValue: 'count',
          options: {
            options: calculations.CALCULATIONS.map((calculation) => ({
              label: calculation.label,
              value: calculation.value,
            })),
          },
        }),
        save_as: Property.ShortText({
          displayName: 'Save as',
          description: 'The name of the result field. Empty: the field name plus the calculation, such as amountSum.',
          required: false,
        }),
      },
    }),
    join_with: Property.ShortText({
      displayName: 'Join with',
      description: 'The separator used by Join as text.',
      required: false,
      defaultValue: ', ',
    }),
    skip_without_group: Property.Checkbox({
      displayName: 'Skip entries without a group value',
      description: 'Off: entries missing a group value form their own group, with that field set to null.',
      required: false,
      defaultValue: false,
    }),
  },
  outputSchema: outputSchemas.groupAndSummarize,
  async run(context) {
    const groupTexts = values
      .readText(context.propsValue.group_by)
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part !== '');
    const groupFields = groupTexts.map((text) => ({ path: paths.parse(text), name: paths.toName(text) }));
    const rows = readCalculationRows(
      context.propsValue.calculations === undefined ? DEFAULT_CALCULATIONS : values.readRows(context.propsValue.calculations),
    );
    const names = rows.map((row) => row.name);
    if (new Set(names).size !== names.length) {
      throw new Error('Each calculation must be saved under a different name.');
    }
    if (rows.some((row) => groupFields.some((group) => group.name === row.name))) {
      throw new Error('A calculation cannot be saved under the name of a group field.');
    }
    const joinWith = typeof context.propsValue.join_with === 'string' ? context.propsValue.join_with : ', ';
    const skipWithoutGroup = values.readFlag({ value: context.propsValue.skip_without_group, fallback: false });
    const entries = lists.readObjects({ value: context.propsValue.list, label: 'List' });
    const groups = groupFields.length === 0 ? [{ groupValues: [], members: entries }] : groupEntries({ entries, groupFields, skipWithoutGroup });
    const results = groups.map((group) =>
      Object.fromEntries([
        ...groupFields.map((field, index): [string, unknown] => [field.name, group.groupValues[index]]),
        ...rows.map((row): [string, unknown] => [
          row.name,
          row.path.length === 0
            ? group.members.length
            : calculations.calculate({
                calculation: row.calculation,
                fieldValues: group.members.map((member) => paths.read({ value: member, path: row.path })),
                joinWith,
              }),
        ]),
      ]),
    );
    return {
      groups: results,
      count: results.length,
    };
  },
});

function readCalculationRows(rows: Record<string, unknown>[]): CalculationRow[] {
  return rows.map((row, index) => {
    const fieldText = values.readText(row['field']).trim();
    const calculation = values.chooseOption({
      value: row['calculation'],
      allowed: calculations.CALCULATION_VALUES,
      fallback: 'count',
      label: `Calculation ${index + 1}`,
    });
    if (fieldText === '' && calculation !== 'count') {
      throw new Error(`Calculation ${index + 1} needs a field. Only Count works without one.`);
    }
    const saveAs = values.readText(row['save_as']).trim();
    return {
      path: paths.parse(fieldText),
      calculation,
      name: saveAs === '' ? calculations.defaultName({ fieldText, calculation }) : saveAs,
    };
  });
}

function groupEntries({
  entries,
  groupFields,
  skipWithoutGroup,
}: {
  entries: Record<string, unknown>[];
  groupFields: GroupField[];
  skipWithoutGroup: boolean;
}): Group[] {
  const groups = new Map<string, Group>();
  entries.forEach((entry) => {
    const found = groupFields.map((field) => paths.read({ value: entry, path: field.path }));
    if (skipWithoutGroup && found.some(values.isMissing)) {
      return;
    }
    const groupValues = found.map((value) => (value === undefined ? null : value));
    const key = equality.canonical({ value: groupValues, options: equality.EXACT });
    const existing = groups.get(key);
    if (existing) {
      existing.members.push(entry);
    } else {
      groups.set(key, { groupValues, members: [entry] });
    }
  });
  return [...groups.values()];
}

const DEFAULT_CALCULATIONS: Record<string, unknown>[] = [{ field: '', calculation: 'count', save_as: '' }];

type GroupField = {
  path: string[];
  name: string;
};

type Group = {
  groupValues: unknown[];
  members: Record<string, unknown>[];
};

type CalculationRow = {
  path: string[];
  calculation: Calculation;
  name: string;
};
