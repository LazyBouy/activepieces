import { createAction, Property } from '@activepieces/pieces-framework';
import { lists } from '../common/lists';
import { paths } from '../common/paths';
import { listProps } from '../common/props';
import { values } from '../common/values';
import { outputSchemas } from '../output-schemas';

export const renameFieldsAction = createAction({
  audience: 'human',
  name: 'rename_fields',
  classification: 'READ',
  displayName: 'Rename Fields',
  description: 'Renames fields on every entry, by name or by pattern.',
  aiMetadata: {
    description:
      'Renames fields of every object in a list: exact renames (all read from the original entry, so two fields can swap) followed by regular-expression rules that rewrite matching key names at chosen depths. A renamed key keeps its position. Read-only and idempotent.',
    idempotent: true,
  },
  props: {
    list: listProps.list({
      displayName: 'List',
      description: 'A list of objects from an earlier step, or JSON text starting with [.',
    }),
    renames: Property.Array({
      displayName: 'Renames',
      description: 'Each row renames one field. A From field that an entry does not have is skipped.',
      required: false,
      properties: {
        from: Property.ShortText({
          displayName: 'From',
          description: 'The current field name. Use dots for nested fields.',
          required: false,
        }),
        to: Property.ShortText({
          displayName: 'To',
          description: 'The new field name. An existing field with this name is replaced.',
          required: false,
        }),
      },
    }),
    pattern_renames: Property.Array({
      displayName: 'Rename by pattern',
      description: 'Applied after Renames, in order, each to the names produced by the rules before it.',
      required: false,
      properties: {
        pattern: Property.ShortText({
          displayName: 'Pattern',
          description: 'A regular expression matched against each field name, for example ^(.*)_id$.',
          required: false,
        }),
        replace_with: Property.ShortText({
          displayName: 'Replace with',
          description: 'The new text for every match. $1, $2 and so on insert the matched groups.',
          required: false,
        }),
        case_sensitive: Property.Checkbox({
          displayName: 'Case sensitive',
          required: false,
          defaultValue: true,
        }),
        nested_levels: Property.Number({
          displayName: 'Nested levels',
          description: '0 renames top-level fields only. Empty: every level.',
          required: false,
        }),
      },
    }),
  },
  outputSchema: outputSchemas.items,
  async run(context) {
    const renames = readRenames(values.readRows(context.propsValue.renames));
    const rules = readPatternRules(values.readRows(context.propsValue.pattern_renames));
    const entries = lists.readObjects({ value: context.propsValue.list, label: 'List' });
    const renamed = entries.map((entry) =>
      rules.reduce<unknown>(
        (current, rule) => renameByPattern({ value: current, rule, level: 0 }),
        applyRenames({ entry, renames }),
      ),
    );
    return {
      items: renamed,
      count: renamed.length,
    };
  },
});

function readRenames(rows: Record<string, unknown>[]): Rename[] {
  return rows.flatMap((row) => {
    const from = paths.parse(values.readText(row['from']));
    const to = paths.parse(values.readText(row['to']));
    return from.length === 0 || to.length === 0 ? [] : [{ from, to }];
  });
}

function readPatternRules(rows: Record<string, unknown>[]): PatternRule[] {
  return rows.flatMap((row, index) => {
    const source = values.readText(row['pattern']);
    if (source === '') {
      return [];
    }
    const caseSensitive = values.readFlag({ value: row['case_sensitive'], fallback: true });
    const levels = row['nested_levels'];
    const maxLevel = levels === undefined || levels === null || levels === '' ? Infinity : values.toNumber(levels);
    if (maxLevel === null || maxLevel < 0 || (Number.isFinite(maxLevel) && !Number.isInteger(maxLevel))) {
      throw new Error(`Nested levels in pattern ${index + 1} must be a whole number of 0 or more.`);
    }
    return [
      {
        regex: compileRule({ source, caseSensitive, position: index + 1 }),
        replacement: values.readText(row['replace_with']),
        maxLevel,
      },
    ];
  });
}

function compileRule({
  source,
  caseSensitive,
  position,
}: {
  source: string;
  caseSensitive: boolean;
  position: number;
}): RegExp {
  try {
    return new RegExp(source, caseSensitive ? 'g' : 'gi');
  } catch {
    throw new Error(`Pattern ${position} is not a valid regular expression.`);
  }
}

function applyRenames({ entry, renames }: { entry: Record<string, unknown>; renames: Rename[] }): unknown {
  const active = renames.flatMap((rename) => {
    const value = paths.read({ value: entry, path: rename.from });
    return value === undefined ? [] : [{ ...rename, value }];
  });
  const sameParent = active.filter(isSameParent);
  const crossParent = active.filter((rename) => !isSameParent(rename));
  const withoutMoved = paths.removeAll({ target: entry, paths: crossParent.map((rename) => rename.from) });
  const renamedInPlace = groupByParent(sameParent).reduce<unknown>(
    (current, group) => {
      const parent = group.parent.length === 0 ? current : paths.read({ value: current, path: group.parent });
      if (!values.isRecord(parent)) {
        return current;
      }
      return paths.write({ target: current, path: group.parent, value: renameKeys({ record: parent, mapping: group.mapping }) });
    },
    withoutMoved,
  );
  return crossParent.reduce<unknown>(
    (current, rename) => paths.write({ target: current, path: rename.to, value: rename.value }),
    renamedInPlace,
  );
}

function isSameParent(rename: Rename): boolean {
  return (
    rename.from.length === rename.to.length &&
    rename.from.slice(0, -1).every((segment, index) => segment === rename.to[index])
  );
}

function groupByParent(renames: Rename[]): { parent: string[]; mapping: Map<string, string> }[] {
  const groups = renames.reduce((byParent, rename) => {
    const parent = rename.from.slice(0, -1);
    const key = JSON.stringify(parent);
    const mapping = byParent.get(key)?.mapping ?? new Map<string, string>();
    mapping.set(rename.from[rename.from.length - 1], rename.to[rename.to.length - 1]);
    byParent.set(key, { parent, mapping });
    return byParent;
  }, new Map<string, { parent: string[]; mapping: Map<string, string> }>());
  return [...groups.values()];
}

function renameKeys({ record, mapping }: { record: Record<string, unknown>; mapping: Map<string, string> }): Record<string, unknown> {
  const targets = new Set(mapping.values());
  return Object.fromEntries(
    Object.entries(record).flatMap(([key, value]): [string, unknown][] => {
      const renamedTo = mapping.get(key);
      if (renamedTo !== undefined) {
        return [[renamedTo, value]];
      }
      return targets.has(key) ? [] : [[key, value]];
    }),
  );
}

function renameByPattern({ value, rule, level }: { value: unknown; rule: PatternRule; level: number }): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => renameByPattern({ value: item, rule, level }));
  }
  if (!values.isRecord(value)) {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, inner]) => [
      key.replace(rule.regex, rule.replacement),
      level < rule.maxLevel ? renameByPattern({ value: inner, rule, level: level + 1 }) : inner,
    ]),
  );
}

type Rename = {
  from: string[];
  to: string[];
};

type PatternRule = {
  regex: RegExp;
  replacement: string;
  maxLevel: number;
};
