import { createAction, InputPropertyMap, Property } from '@activepieces/pieces-framework';
import { EqualityOptions } from '../common/equality';
import { lists } from '../common/lists';
import { ConflictRule, MatchPair, merge } from '../common/merge';
import { listProps } from '../common/props';
import { values } from '../common/values';
import { outputSchemas } from '../output-schemas';

export const combineListsAction = createAction({
  audience: 'human',
  name: 'combine_lists',
  classification: 'READ',
  displayName: 'Combine Lists',
  description: 'Joins two lists into one: one after the other, matched by fields, paired by position, or every combination.',
  aiMetadata: {
    description:
      'Builds one list from two: appends them, merges entries whose key fields match (keeping matches only or also the unmatched entries of either side), merges entries at the same position, or merges every pair. Field clashes use the second value, the first value, or both renamed. It works inside one step; it does not join two branches of a flow. Read-only and idempotent.',
    idempotent: true,
  },
  props: {
    first_list: listProps.list({
      displayName: 'First list',
      description: 'A list from an earlier step, or JSON text starting with [.',
    }),
    second_list: listProps.list({
      displayName: 'Second list',
      description: 'A list from an earlier step, or JSON text starting with [.',
    }),
    how: Property.StaticDropdown<CombineMode, false>({
      displayName: 'How',
      description: 'Every mode except One after the other needs entries that are objects.',
      required: false,
      defaultValue: 'append',
      options: {
        options: [
          { label: 'One after the other', value: 'append' },
          { label: 'Match by fields', value: 'match' },
          { label: 'Pair by position', value: 'position' },
          { label: 'Every combination', value: 'combination' },
        ],
      },
    }),
    how_options: listProps.shownFor({
      displayName: 'Match on',
      refresher: 'how',
      build: (how): InputPropertyMap => {
        if (how === 'match') {
          return { match_on: listProps.matchOn(), keep: keepProperty(), when_both: whenBothProperty() };
        }
        if (how === 'position' || how === 'combination') {
          return { when_both: whenBothProperty() };
        }
        return {};
      },
    }),
    merge_nested: Property.Checkbox({
      displayName: 'Merge nested objects',
      description: 'On: nested objects present in both entries are combined field by field instead of replaced.',
      required: false,
      defaultValue: true,
    }),
    more_options: listProps.shownFor({
      displayName: 'Keep unpaired entries',
      refresher: 'how',
      build: (how): InputPropertyMap => {
        if (how === 'position') {
          return {
            keep_unpaired: Property.Checkbox({
              displayName: 'Keep unpaired entries',
              description: 'On: the leftover entries of the longer list follow the pairs.',
              required: false,
              defaultValue: false,
            }),
          };
        }
        if (how === 'match') {
          return {
            numbers_as_text: listProps.numbersAsText(),
            case_sensitive: listProps.caseSensitive({
              defaultValue: true,
              description: 'Off: "Ann" and "ann" count as the same key.',
            }),
          };
        }
        return {};
      },
    }),
  },
  outputSchema: outputSchemas.items,
  async run(context) {
    const how = values.chooseOption({
      value: context.propsValue.how,
      allowed: COMBINE_MODES,
      fallback: 'append',
      label: 'How',
    });
    const howOptions = values.readRecord(context.propsValue.how_options);
    const moreOptions = values.readRecord(context.propsValue.more_options);
    if (how === 'append') {
      const items = [
        ...lists.readList({ value: context.propsValue.first_list, label: 'First list' }),
        ...lists.readList({ value: context.propsValue.second_list, label: 'Second list' }),
      ];
      return { items, count: items.length };
    }
    const rule = values.chooseOption({
      value: howOptions['when_both'],
      allowed: CONFLICT_RULES,
      fallback: 'second',
      label: 'When both have a field',
    });
    const nested = values.readFlag({ value: context.propsValue.merge_nested, fallback: true });
    const combineTwo = ({ first, second }: EntryPair) => merge.combine({ first, second, rule, nested });
    const pairs = how === 'match' ? merge.readMatchPairs(values.readRows(howOptions['match_on'])) : [];
    const keep = values.chooseOption({
      value: howOptions['keep'],
      allowed: KEEP_MODES,
      fallback: 'matches',
      label: 'Keep',
    });
    const first = lists.readObjects({ value: context.propsValue.first_list, label: 'First list' });
    const second = lists.readObjects({ value: context.propsValue.second_list, label: 'Second list' });
    const items = combineByMode({
      how,
      first,
      second,
      combineTwo,
      pairs,
      keep,
      keepUnpaired: values.readFlag({ value: moreOptions['keep_unpaired'], fallback: false }),
      options: {
        caseSensitive: values.readFlag({ value: moreOptions['case_sensitive'], fallback: true }),
        numbersAsText: values.readFlag({ value: moreOptions['numbers_as_text'], fallback: false }),
      },
    });
    return { items, count: items.length };
  },
});

function combineByMode({
  how,
  first,
  second,
  combineTwo,
  pairs,
  keep,
  keepUnpaired,
  options,
}: {
  how: Exclude<CombineMode, 'append'>;
  first: Record<string, unknown>[];
  second: Record<string, unknown>[];
  combineTwo: (pair: EntryPair) => Record<string, unknown>;
  pairs: MatchPair[];
  keep: KeepMode;
  keepUnpaired: boolean;
  options: EqualityOptions;
}): Record<string, unknown>[] {
  switch (how) {
    case 'position': {
      const shared = Math.min(first.length, second.length);
      const paired = first.slice(0, shared).map((entry, index) => combineTwo({ first: entry, second: second[index] }));
      return keepUnpaired ? [...paired, ...first.slice(shared), ...second.slice(shared)] : paired;
    }
    case 'combination': {
      const total = first.length * second.length;
      if (total > MAX_COMBINATIONS) {
        throw new Error(
          `Every combination would create ${total} entries, more than the limit of ${MAX_COMBINATIONS}. Use shorter lists.`,
        );
      }
      return first.flatMap((entry) => second.map((other) => combineTwo({ first: entry, second: other })));
    }
    case 'match': {
      const secondByKey = merge.indexByKey({ entries: second, pairs, options });
      const matchesOf = first.map((entry) => {
        const key = merge.matchKey({ entry, pairs, side: 'first', options });
        return key === null ? [] : secondByKey.get(key) ?? [];
      });
      const keepFirst = keep === 'all_first' || keep === 'all_both';
      const keepSecond = keep === 'all_second' || keep === 'all_both';
      const fromFirst = first.flatMap((entry, index) => {
        const matches = matchesOf[index];
        if (matches.length === 0) {
          return keepFirst ? [entry] : [];
        }
        return matches.map((position) => combineTwo({ first: entry, second: second[position] }));
      });
      const matchedSecond = new Set(matchesOf.flat());
      const fromSecond = keepSecond ? second.filter((_, position) => !matchedSecond.has(position)) : [];
      return [...fromFirst, ...fromSecond];
    }
  }
}

function keepProperty() {
  return Property.StaticDropdown<KeepMode, false>({
    displayName: 'Keep',
    description: 'Which entries without a match are added as they are.',
    required: false,
    defaultValue: 'matches',
    options: {
      options: [
        { label: 'Matches only', value: 'matches' },
        { label: 'All from the first list', value: 'all_first' },
        { label: 'All from the second list', value: 'all_second' },
        { label: 'All from both lists', value: 'all_both' },
      ],
    },
  });
}

function whenBothProperty() {
  return Property.StaticDropdown<ConflictRule, false>({
    displayName: 'When both have a field',
    description: 'Keep both, renamed saves them as first_<name> and second_<name>.',
    required: false,
    defaultValue: 'second',
    options: {
      options: [
        { label: "Use the second list's value", value: 'second' },
        { label: "Use the first list's value", value: 'first' },
        { label: 'Keep both, renamed', value: 'both' },
      ],
    },
  });
}

const MAX_COMBINATIONS = 100000;
const COMBINE_MODES: readonly CombineMode[] = ['append', 'match', 'position', 'combination'];
const KEEP_MODES: readonly KeepMode[] = ['matches', 'all_first', 'all_second', 'all_both'];
const CONFLICT_RULES: readonly ConflictRule[] = ['second', 'first', 'both'];

type CombineMode = 'append' | 'match' | 'position' | 'combination';
type KeepMode = 'matches' | 'all_first' | 'all_second' | 'all_both';

type EntryPair = {
  first: Record<string, unknown>;
  second: Record<string, unknown>;
};
