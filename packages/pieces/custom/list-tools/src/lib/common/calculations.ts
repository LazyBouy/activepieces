import { compare } from './compare';
import { equality } from './equality';
import { paths } from './paths';
import { values } from './values';

function defaultName({ fieldText, calculation }: { fieldText: string; calculation: Calculation }): string {
  const suffix = SUFFIXES[calculation];
  return fieldText.trim() === '' ? `${suffix.charAt(0).toLowerCase()}${suffix.slice(1)}` : `${paths.toName(fieldText)}${suffix}`;
}

function calculate({
  calculation,
  fieldValues,
  joinWith,
}: {
  calculation: Calculation;
  fieldValues: unknown[];
  joinWith: string;
}): unknown {
  const present = fieldValues.filter((value) => !values.isEmpty(value));
  switch (calculation) {
    case 'count':
      return present.length;
    case 'count_unique':
      return new Set(present.map((value) => equality.canonical({ value, options: equality.EXACT }))).size;
    case 'sum':
      return numbersOf(fieldValues).reduce((total, value) => total + value, 0);
    case 'average': {
      const numbers = numbersOf(fieldValues);
      return numbers.length === 0 ? null : numbers.reduce((total, value) => total + value, 0) / numbers.length;
    }
    case 'minimum':
      return extreme({ present, direction: -1 });
    case 'maximum':
      return extreme({ present, direction: 1 });
    case 'list':
      return present;
    case 'join':
      return present.map(values.toDisplayText).join(joinWith);
    case 'first':
      return fieldValues.length === 0 || fieldValues[0] === undefined ? null : fieldValues[0];
    case 'last': {
      const last = fieldValues[fieldValues.length - 1];
      return last === undefined ? null : last;
    }
  }
}

function numbersOf(fieldValues: unknown[]): number[] {
  return fieldValues.flatMap((value) => {
    const asNumber = values.toNumber(value);
    return asNumber === null ? [] : [asNumber];
  });
}

function extreme({ present, direction }: { present: unknown[]; direction: 1 | -1 }): unknown {
  const keyed = keyForExtreme(present);
  if (keyed.length === 0) {
    return null;
  }
  const collator = compare.createTextCollator(false);
  const best = keyed.reduce((winner, candidate) => {
    const order =
      typeof candidate.key === 'number' && typeof winner.key === 'number'
        ? candidate.key - winner.key
        : collator.compare(String(candidate.key), String(winner.key));
    return order * direction > 0 ? candidate : winner;
  });
  return best.value;
}

function keyForExtreme(present: unknown[]): { value: unknown; key: number | string }[] {
  const asNumbers = present.map(values.toNumber);
  if (present.length > 0 && asNumbers.every((value) => value !== null)) {
    return present.map((value, index) => ({ value, key: asNumbers[index] ?? 0 }));
  }
  const asDates = present.map(values.toDate);
  if (present.length > 0 && asDates.every((value) => value !== null)) {
    return present.map((value, index) => ({ value, key: asDates[index] ?? 0 }));
  }
  return present.flatMap((value) => {
    const text = values.toText(value);
    return text === null ? [] : [{ value, key: text }];
  });
}

const CALCULATIONS = [
  { value: 'count', label: 'Count' },
  { value: 'count_unique', label: 'Count unique' },
  { value: 'sum', label: 'Sum' },
  { value: 'average', label: 'Average' },
  { value: 'minimum', label: 'Minimum' },
  { value: 'maximum', label: 'Maximum' },
  { value: 'list', label: 'List of values' },
  { value: 'join', label: 'Join as text' },
  { value: 'first', label: 'First value' },
  { value: 'last', label: 'Last value' },
] as const;

const CALCULATION_VALUES: readonly Calculation[] = CALCULATIONS.map((calculation) => calculation.value);

const SUFFIXES: Record<Calculation, string> = {
  count: 'Count',
  count_unique: 'CountUnique',
  sum: 'Sum',
  average: 'Average',
  minimum: 'Minimum',
  maximum: 'Maximum',
  list: 'ListOfValues',
  join: 'JoinAsText',
  first: 'FirstValue',
  last: 'LastValue',
};

export const calculations = {
  defaultName,
  calculate,
  CALCULATIONS,
  CALCULATION_VALUES,
};

export type Calculation = (typeof CALCULATIONS)[number]['value'];
