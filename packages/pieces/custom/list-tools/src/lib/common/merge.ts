import { equality, EqualityOptions } from './equality';
import { paths } from './paths';
import { values } from './values';

function combine({
  first,
  second,
  rule,
  nested,
}: {
  first: Record<string, unknown>;
  second: Record<string, unknown>;
  rule: ConflictRule;
  nested: boolean;
}): Record<string, unknown> {
  const fromFirst = Object.entries(first).flatMap(([key, value]): [string, unknown][] => {
    if (!values.hasOwn({ record: second, key })) {
      return [[key, value]];
    }
    const other = second[key];
    if (nested && values.isRecord(value) && values.isRecord(other)) {
      return [[key, combine({ first: value, second: other, rule, nested })]];
    }
    switch (rule) {
      case 'second':
        return [[key, other]];
      case 'first':
        return [[key, value]];
      case 'both':
        return [
          [`first_${key}`, value],
          [`second_${key}`, other],
        ];
    }
  });
  const onlyInSecond = Object.entries(second).filter(([key]) => !values.hasOwn({ record: first, key }));
  return Object.fromEntries([...fromFirst, ...onlyInSecond]);
}

function readMatchPairs(rows: Record<string, unknown>[]): MatchPair[] {
  const pairs = rows.flatMap((row) => {
    const first = paths.parse(values.readText(row['field_in_first']));
    const second = paths.parse(values.readText(row['field_in_second']));
    return first.length === 0 || second.length === 0 ? [] : [{ first, second }];
  });
  if (pairs.length === 0) {
    throw new Error('Add at least one pair of fields to match on.');
  }
  return pairs;
}

function matchKey({
  entry,
  pairs,
  side,
  options,
}: {
  entry: Record<string, unknown>;
  pairs: MatchPair[];
  side: 'first' | 'second';
  options: EqualityOptions;
}): string | null {
  const parts = pairs.map((pair) => paths.read({ value: entry, path: pair[side] }));
  if (parts.some(values.isMissing)) {
    return null;
  }
  return equality.canonical({ value: parts, options });
}

function indexByKey({
  entries,
  pairs,
  options,
}: {
  entries: Record<string, unknown>[];
  pairs: MatchPair[];
  options: EqualityOptions;
}): Map<string, number[]> {
  return entries.reduce((index, entry, position) => {
    const key = matchKey({ entry, pairs, side: 'second', options });
    if (key === null) {
      return index;
    }
    const existing = index.get(key);
    if (existing) {
      existing.push(position);
    } else {
      index.set(key, [position]);
    }
    return index;
  }, new Map<string, number[]>());
}

export const merge = {
  combine,
  readMatchPairs,
  matchKey,
  indexByKey,
};

export type ConflictRule = 'second' | 'first' | 'both';

export type MatchPair = {
  first: string[];
  second: string[];
};
