import { createAction, InputPropertyMap, Property } from '@activepieces/pieces-framework';
import { equality } from '../common/equality';
import { lists } from '../common/lists';
import { listProps } from '../common/props';
import { seenStore } from '../common/seen-store';
import { values } from '../common/values';
import { outputSchemas } from '../output-schemas';

export const forgetSeenItemsAction = createAction({
  audience: 'both',
  name: 'forget_seen_items',
  classification: 'DESTRUCTIVE',
  displayName: 'Forget Seen Items',
  description: 'Clears a memory used by Keep New Items, or only some of the keys in it.',
  aiMetadata: {
    description:
      'Removes remembered keys from a Keep New Items memory, either all of them or only the listed keys, so those entries count as new again on the next run. Use the same Remember for and Memory name as the Keep New Items step. Clearing a memory that does not exist is not an error; repeating the call leaves the same result.',
    idempotent: true,
  },
  props: {
    remember_for: listProps.rememberFor(),
    memory_name: listProps.memoryName(),
    forget: Property.StaticDropdown<ForgetMode, false>({
      displayName: 'Forget',
      required: false,
      defaultValue: 'everything',
      options: {
        options: [
          { label: 'Everything', value: 'everything' },
          { label: 'These keys', value: 'keys' },
        ],
      },
    }),
    keys_options: listProps.shownFor({
      displayName: 'Keys',
      refresher: 'forget',
      build: (forget): InputPropertyMap =>
        forget === 'keys'
          ? {
              keys: Property.Json({
                displayName: 'Keys',
                description: 'A list of the key values to forget, for example ["A-100", "A-101"] or [17, 18].',
                required: true,
              }),
            }
          : {},
    }),
  },
  outputSchema: outputSchemas.forgetSeenItems,
  async run(context) {
    const scope = listProps.toStoreScope(
      values.chooseOption({
        value: context.propsValue.remember_for,
        allowed: listProps.REMEMBER_FOR_VALUES,
        fallback: 'flow',
        label: 'Remember for',
      }),
    );
    const name = seenStore.readMemoryName(context.propsValue.memory_name);
    const forget = values.chooseOption({
      value: context.propsValue.forget,
      allowed: FORGET_MODES,
      fallback: 'everything',
      label: 'Forget',
    });
    if (forget === 'everything') {
      const forgottenCount = await seenStore.clear({ store: context.store, scope, name });
      return { forgottenCount };
    }
    const keysToForget = new Set(
      lists
        .readList({ value: values.readRecord(context.propsValue.keys_options)['keys'], label: 'Keys' })
        .map((key) => equality.canonical({ value: key, options: equality.EXACT })),
    );
    const memory = await seenStore.load({ store: context.store, scope, name });
    const remaining = memory.keys.filter((key) => !keysToForget.has(key));
    const forgottenCount = memory.keys.length - remaining.length;
    if (forgottenCount > 0) {
      await seenStore.save({
        store: context.store,
        scope,
        name,
        keys: remaining,
        previousPageCount: memory.pageCount,
      });
    }
    return { forgottenCount };
  },
});

const FORGET_MODES: readonly ForgetMode[] = ['everything', 'keys'];

type ForgetMode = 'everything' | 'keys';
