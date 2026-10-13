import { paths } from './paths';
import { values } from './values';

function createTextCollator(caseSensitive: boolean): Intl.Collator {
  return new Intl.Collator('en', { numeric: true, sensitivity: caseSensitive ? 'variant' : 'accent' });
}

function prepare({ value, compareAs }: { value: unknown; compareAs: CompareAs }): PreparedValue | null {
  switch (compareAs) {
    case 'number': {
      const asNumber = values.toNumber(value);
      return asNumber === null ? null : { number: asNumber, text: null };
    }
    case 'date': {
      const asDate = values.toDate(value);
      return asDate === null ? null : { number: asDate, text: null };
    }
    case 'text': {
      const asText = values.toText(value);
      return asText === null ? null : { number: null, text: asText };
    }
    case 'auto': {
      const asText = values.toText(value);
      return asText === null ? null : { number: values.toNumber(value), text: asText };
    }
  }
}

function comparePrepared({
  first,
  second,
  collator,
}: {
  first: PreparedValue;
  second: PreparedValue;
  collator: Intl.Collator;
}): number {
  if (first.number !== null && second.number !== null) {
    return first.number === second.number ? 0 : first.number < second.number ? -1 : 1;
  }
  return collator.compare(first.text ?? '', second.text ?? '');
}

function sortItems({
  items,
  keys,
  caseSensitive,
}: {
  items: unknown[];
  keys: SortKey[];
  caseSensitive: boolean;
}): unknown[] {
  const collator = createTextCollator(caseSensitive);
  const prepared = items.map((item) =>
    keys.map((key) => prepare({ value: paths.read({ value: item, path: key.path }), compareAs: key.compareAs })),
  );
  const order = items.map((_, index) => index);
  order.sort((left, right) => {
    for (let keyIndex = 0; keyIndex < keys.length; keyIndex++) {
      const first = prepared[left][keyIndex];
      const second = prepared[right][keyIndex];
      if (first === null && second === null) {
        continue;
      }
      if (first === null) {
        return 1;
      }
      if (second === null) {
        return -1;
      }
      const result = comparePrepared({ first, second, collator });
      if (result !== 0) {
        return keys[keyIndex].direction === 'descending' ? -result : result;
      }
    }
    return left - right;
  });
  return order.map((index) => items[index]);
}

function shuffle({ items, random }: { items: unknown[]; random: () => number }): unknown[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) {
    const target = Math.floor(random() * (index + 1));
    const held = copy[index];
    copy[index] = copy[target];
    copy[target] = held;
  }
  return copy;
}

function compareValues({
  first,
  second,
  compareAs,
  caseSensitive,
}: {
  first: unknown;
  second: unknown;
  compareAs: CompareAs;
  caseSensitive: boolean;
}): number | null {
  const preparedFirst = prepare({ value: first, compareAs });
  const preparedSecond = prepare({ value: second, compareAs });
  if (preparedFirst === null || preparedSecond === null) {
    return null;
  }
  return comparePrepared({ first: preparedFirst, second: preparedSecond, collator: createTextCollator(caseSensitive) });
}

export const compare = {
  sortItems,
  shuffle,
  compareValues,
  createTextCollator,
};

export type CompareAs = 'auto' | 'text' | 'number' | 'date';

export type SortDirection = 'ascending' | 'descending';

export type SortKey = {
  path: string[];
  direction: SortDirection;
  compareAs: CompareAs;
};

type PreparedValue = {
  number: number | null;
  text: string | null;
};
