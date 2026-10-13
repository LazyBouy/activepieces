import { createAction, Property } from '@activepieces/pieces-framework';
import { equality, EqualityOptions } from '../common/equality';
import { lists } from '../common/lists';
import { merge, MatchPair } from '../common/merge';
import { paths } from '../common/paths';
import { listProps } from '../common/props';
import { values } from '../common/values';
import { outputSchemas } from '../output-schemas';

export const compareListsAction = createAction({
  audience: 'human',
  name: 'compare_lists',
  classification: 'READ',
  displayName: 'Compare Lists',
  description: 'Pairs entries of two lists by key and sorts them into four groups.',
  aiMetadata: {
    description:
      'Matches the objects of two lists on one or more key fields and returns what is only in the first list, only in the second, the same in both, and different (with the names of the changed fields). Use it to sync two systems or spot changes between snapshots; use Combine Lists to merge matched entries instead. Read-only and idempotent.',
    idempotent: true,
  },
  props: {
    first_list: listProps.list({
      displayName: 'First list',
      description: 'A list of objects from an earlier step, or JSON text starting with [.',
    }),
    second_list: listProps.list({
      displayName: 'Second list',
      description: 'A list of objects from an earlier step, or JSON text starting with [.',
    }),
    match_on: listProps.matchOn(),
    ignore_fields: Property.ShortText({
      displayName: 'Ignore these fields when comparing',
      description: 'Field names separated by commas, such as updatedAt. They do not make a pair different.',
      required: false,
    }),
    numbers_as_text: listProps.numbersAsText(),
    case_sensitive: listProps.caseSensitive({
      defaultValue: true,
      description: 'Off: "Ann" and "ann" count as the same text, in keys and values.',
    }),
  },
  outputSchema: outputSchemas.compareLists,
  async run(context) {
    const pairs = merge.readMatchPairs(values.readRows(context.propsValue.match_on));
    const options: EqualityOptions = {
      caseSensitive: values.readFlag({ value: context.propsValue.case_sensitive, fallback: true }),
      numbersAsText: values.readFlag({ value: context.propsValue.numbers_as_text, fallback: false }),
    };
    const ignorePaths = paths.parseList(values.readText(context.propsValue.ignore_fields));
    const first = lists.readObjects({ value: context.propsValue.first_list, label: 'First list' });
    const second = lists.readObjects({ value: context.propsValue.second_list, label: 'Second list' });
    const secondByKey = merge.indexByKey({ entries: second, pairs, options });
    const nextUnpaired = new Map<string, number>();
    const pairings = first.map((entry) => {
      const key = merge.matchKey({ entry, pairs, side: 'first', options });
      if (key === null) {
        return { entry, partner: null };
      }
      const candidates = secondByKey.get(key) ?? [];
      const next = nextUnpaired.get(key) ?? 0;
      nextUnpaired.set(key, next + 1);
      return { entry, partner: next < candidates.length ? candidates[next] : null };
    });
    const pairedSecond = new Set(pairings.flatMap((pairing) => (pairing.partner === null ? [] : [pairing.partner])));
    const compared = pairings.flatMap((pairing) =>
      pairing.partner === null
        ? []
        : [
            {
              first: pairing.entry,
              second: second[pairing.partner],
              changedFields: changedFields({
                first: pairing.entry,
                second: second[pairing.partner],
                pairs,
                ignorePaths,
                options,
              }),
            },
          ],
    );
    const onlyInFirst = pairings.filter((pairing) => pairing.partner === null).map((pairing) => pairing.entry);
    const onlyInSecond = second.filter((_, position) => !pairedSecond.has(position));
    const same = compared.filter((pair) => pair.changedFields.length === 0).map((pair) => pair.first);
    const different = compared.filter((pair) => pair.changedFields.length > 0);
    return {
      onlyInFirst,
      onlyInSecond,
      same,
      different,
      counts: {
        onlyInFirst: onlyInFirst.length,
        onlyInSecond: onlyInSecond.length,
        same: same.length,
        different: different.length,
      },
    };
  },
});

function changedFields({
  first,
  second,
  pairs,
  ignorePaths,
  options,
}: {
  first: Record<string, unknown>;
  second: Record<string, unknown>;
  pairs: MatchPair[];
  ignorePaths: string[][];
  options: EqualityOptions;
}): string[] {
  const left = values.readRecord(
    paths.removeAllAndPrune({ target: first, paths: [...ignorePaths, ...pairs.map((pair) => pair.first)] }),
  );
  const right = values.readRecord(
    paths.removeAllAndPrune({ target: second, paths: [...ignorePaths, ...pairs.map((pair) => pair.second)] }),
  );
  const names = [...new Set([...Object.keys(left), ...Object.keys(right)])];
  return names.filter(
    (name) =>
      equality.canonical({ value: values.hasOwn({ record: left, key: name }) ? left[name] : undefined, options }) !==
      equality.canonical({ value: values.hasOwn({ record: right, key: name }) ? right[name] : undefined, options }),
  );
}
