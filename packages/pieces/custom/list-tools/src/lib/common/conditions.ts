import { equality } from './equality';
import { lists } from './lists';
import { paths } from './paths';
import { values } from './values';

function compileConditions({
  rows,
  caseSensitive,
}: {
  rows: Record<string, unknown>[];
  caseSensitive: boolean;
}): CompiledCondition[] {
  const compiled = rows.flatMap((row, index): CompiledCondition[] => {
    const field = values.readText(row['field']).trim();
    if (field === '') {
      return [];
    }
    const operator = values.chooseOption({
      value: row['operator'],
      allowed: OPERATOR_VALUES,
      fallback: 'text_exactly_matches',
      label: `Operator in condition ${index + 1}`,
    });
    const valueText = values.readText(row['value']);
    return [
      {
        path: paths.parse(field),
        test: buildTest({ operator, valueText, caseSensitive, position: index + 1 }),
      },
    ];
  });
  if (compiled.length === 0) {
    throw new Error('Add at least one condition with a field.');
  }
  return compiled;
}

function matches({
  item,
  conditions,
  matchAll,
}: {
  item: Record<string, unknown>;
  conditions: CompiledCondition[];
  matchAll: boolean;
}): boolean {
  const passes = (condition: CompiledCondition) => condition.test(paths.read({ value: item, path: condition.path }));
  return matchAll ? conditions.every(passes) : conditions.some(passes);
}

function buildTest({
  operator,
  valueText,
  caseSensitive,
  position,
}: {
  operator: Operator;
  valueText: string;
  caseSensitive: boolean;
  position: number;
}): (field: unknown) => boolean {
  const normalize = (text: string) => (caseSensitive ? text : text.toLowerCase());
  const expected = normalize(valueText);
  const textTest = (check: (text: string) => boolean) => (field: unknown) => {
    const text = values.toText(field);
    return text !== null && check(normalize(text));
  };
  const numberTest = (check: (pair: NumberPair) => boolean) => {
    const expectedNumber = values.toNumber(valueText);
    return (field: unknown) => {
      const fieldNumber = values.toNumber(field);
      return fieldNumber !== null && expectedNumber !== null && check({ actual: fieldNumber, target: expectedNumber });
    };
  };
  const dateTest = (check: (pair: NumberPair) => boolean) => {
    const expectedDate = values.toDate(valueText);
    return (field: unknown) => {
      const fieldDate = values.toDate(field);
      return fieldDate !== null && expectedDate !== null && check({ actual: fieldDate, target: expectedDate });
    };
  };
  const listTest = (check: (list: unknown[]) => boolean) => (field: unknown) => Array.isArray(field) && check(field);
  switch (operator) {
    case 'exists':
      return (field) => !values.isMissing(field);
    case 'does_not_exist':
      return (field) => values.isMissing(field);
    case 'is_empty':
      return (field) => values.isEmpty(field);
    case 'is_not_empty':
      return (field) => !values.isEmpty(field);
    case 'text_exactly_matches':
      return textTest((text) => text === expected);
    case 'text_does_not_exactly_match':
      return textTest((text) => text !== expected);
    case 'text_contains':
      return textTest((text) => text.includes(expected));
    case 'text_does_not_contain':
      return textTest((text) => !text.includes(expected));
    case 'text_starts_with':
      return textTest((text) => text.startsWith(expected));
    case 'text_does_not_start_with':
      return textTest((text) => !text.startsWith(expected));
    case 'text_ends_with':
      return textTest((text) => text.endsWith(expected));
    case 'text_does_not_end_with':
      return textTest((text) => !text.endsWith(expected));
    case 'text_matches_pattern': {
      const pattern = compilePattern({ source: valueText, caseSensitive, position });
      return (field) => {
        const text = values.toText(field);
        return text !== null && pattern.test(text);
      };
    }
    case 'number_equal':
      return numberTest(({ actual, target }) => actual === target);
    case 'number_not_equal':
      return numberTest(({ actual, target }) => actual !== target);
    case 'number_greater':
      return numberTest(({ actual, target }) => actual > target);
    case 'number_greater_or_equal':
      return numberTest(({ actual, target }) => actual >= target);
    case 'number_less':
      return numberTest(({ actual, target }) => actual < target);
    case 'number_less_or_equal':
      return numberTest(({ actual, target }) => actual <= target);
    case 'boolean_true':
      return (field) => values.toBoolean(field) === true;
    case 'boolean_false':
      return (field) => values.toBoolean(field) === false;
    case 'date_before':
      return dateTest(({ actual, target }) => actual < target);
    case 'date_after':
      return dateTest(({ actual, target }) => actual > target);
    case 'date_equals':
      return dateTest(({ actual, target }) => actual === target);
    case 'list_contains': {
      const candidates = listCandidates({ valueText, caseSensitive });
      return listTest((list) => list.some((entry) => candidates.has(canonicalEntry({ entry, caseSensitive }))));
    }
    case 'list_does_not_contain': {
      const candidates = listCandidates({ valueText, caseSensitive });
      return listTest((list) => !list.some((entry) => candidates.has(canonicalEntry({ entry, caseSensitive }))));
    }
    case 'list_is_empty':
      return listTest((list) => list.length === 0);
    case 'list_is_not_empty':
      return listTest((list) => list.length > 0);
    case 'list_has_length': {
      const length = values.toNumber(valueText);
      return listTest((list) => length !== null && list.length === length);
    }
  }
}

function compilePattern({
  source,
  caseSensitive,
  position,
}: {
  source: string;
  caseSensitive: boolean;
  position: number;
}): RegExp {
  try {
    return new RegExp(source, caseSensitive ? '' : 'i');
  } catch {
    throw new Error(`The pattern in condition ${position} is not a valid regular expression.`);
  }
}

function listCandidates({ valueText, caseSensitive }: { valueText: string; caseSensitive: boolean }): Set<string> {
  const parsed = lists.parseJson(valueText);
  const candidates = parsed === undefined || typeof parsed === 'string' ? [valueText] : [valueText, parsed];
  return new Set(candidates.map((entry) => canonicalEntry({ entry, caseSensitive })));
}

function canonicalEntry({ entry, caseSensitive }: { entry: unknown; caseSensitive: boolean }): string {
  return equality.canonical({ value: entry, options: { caseSensitive, numbersAsText: false } });
}

const OPERATORS = [
  { value: 'exists', label: 'Exists' },
  { value: 'does_not_exist', label: 'Does not exist' },
  { value: 'is_empty', label: 'Is empty' },
  { value: 'is_not_empty', label: 'Is not empty' },
  { value: 'text_exactly_matches', label: 'Exactly matches (Text)' },
  { value: 'text_does_not_exactly_match', label: 'Does not exactly match (Text)' },
  { value: 'text_contains', label: 'Contains (Text)' },
  { value: 'text_does_not_contain', label: 'Does not contain (Text)' },
  { value: 'text_starts_with', label: 'Starts with (Text)' },
  { value: 'text_does_not_start_with', label: 'Does not start with (Text)' },
  { value: 'text_ends_with', label: 'Ends with (Text)' },
  { value: 'text_does_not_end_with', label: 'Does not end with (Text)' },
  { value: 'text_matches_pattern', label: 'Matches pattern (Text)' },
  { value: 'number_equal', label: 'Is equal to (Number)' },
  { value: 'number_not_equal', label: 'Is not equal to (Number)' },
  { value: 'number_greater', label: 'Is greater than (Number)' },
  { value: 'number_greater_or_equal', label: 'Is greater than or equal to (Number)' },
  { value: 'number_less', label: 'Is less than (Number)' },
  { value: 'number_less_or_equal', label: 'Is less than or equal to (Number)' },
  { value: 'boolean_true', label: 'Is true (Boolean)' },
  { value: 'boolean_false', label: 'Is false (Boolean)' },
  { value: 'date_before', label: 'Before (Date/time)' },
  { value: 'date_after', label: 'After (Date/time)' },
  { value: 'date_equals', label: 'Equals (Date/time)' },
  { value: 'list_contains', label: 'Contains (List)' },
  { value: 'list_does_not_contain', label: 'Does not contain (List)' },
  { value: 'list_is_empty', label: 'Is empty (List)' },
  { value: 'list_is_not_empty', label: 'Is not empty (List)' },
  { value: 'list_has_length', label: 'Has length (List)' },
] as const;

const OPERATOR_VALUES: readonly Operator[] = OPERATORS.map((operator) => operator.value);

export const conditions = {
  compileConditions,
  matches,
  OPERATORS,
};

export type Operator = (typeof OPERATORS)[number]['value'];

type NumberPair = {
  actual: number;
  target: number;
};

export type CompiledCondition = {
  path: string[];
  test: (field: unknown) => boolean;
};
