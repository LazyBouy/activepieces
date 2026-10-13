import { createAction, Property } from '@activepieces/pieces-framework';
import { equality } from '../common/equality';
import { lists } from '../common/lists';
import { paths } from '../common/paths';
import { listProps } from '../common/props';
import { seenStore } from '../common/seen-store';
import { values } from '../common/values';
import { outputSchemas } from '../output-schemas';

export const keepNewItemsAction = createAction({
  audience: 'both',
  name: 'keep_new_items',
  classification: 'WRITE',
  displayName: 'Keep New Items',
  description:
    'Keeps only entries whose key has not been seen in earlier runs of the flow, and remembers the keys it lets through. Test runs in the builder use the same memory as live runs.',
  aiMetadata: {
    description:
      'Passes on only the entries whose key (a field, or the entry itself) was not seen in earlier runs, then remembers those keys in a named memory for this flow or for the whole project. Use it to process each record once across runs; use Forget Seen Items to clear the memory and Remove Duplicates for repeats inside one list. Calling it again skips what it already let through, so it is not safe to retry.',
    idempotent: false,
  },
  props: {
    list: listProps.list({
      displayName: 'List',
      description: 'A list from an earlier step, or JSON text starting with [.',
    }),
    key_field: Property.ShortText({
      displayName: 'Key field',
      description:
        'The field that identifies an entry, such as id or customer.email. Leave empty when the list holds plain values such as texts or numbers.',
      required: false,
    }),
    remember_for: listProps.rememberFor(),
    memory_name: listProps.memoryName(),
    memory_size: Property.Number({
      displayName: 'Memory size',
      description: 'The most keys to remember. Once it is reached, the oldest keys are forgotten first.',
      required: false,
      defaultValue: seenStore.DEFAULT_MEMORY_SIZE,
    }),
  },
  outputSchema: outputSchemas.keepNewItems,
  async run(context) {
    const keyPath = paths.parse(values.readText(context.propsValue.key_field));
    const scope = listProps.toStoreScope(
      values.chooseOption({
        value: context.propsValue.remember_for,
        allowed: listProps.REMEMBER_FOR_VALUES,
        fallback: 'flow',
        label: 'Remember for',
      }),
    );
    const name = seenStore.readMemoryName(context.propsValue.memory_name);
    const memorySize = readMemorySize(context.propsValue.memory_size);
    const entries = lists.readList({ value: context.propsValue.list, label: 'List' });
    const memory = await seenStore.load({ store: context.store, scope, name });
    const seen = new Set(memory.keys);
    const decisions = entries.map((entry) => {
      const keyValue = keyPath.length === 0 ? entry : paths.read({ value: entry, path: keyPath });
      if (values.isMissing(keyValue)) {
        return { entry, key: null, isNew: true };
      }
      const key = equality.canonical({ value: keyValue, options: equality.EXACT });
      const isNew = !seen.has(key);
      seen.add(key);
      return { entry, key, isNew };
    });
    const items = decisions.filter((decision) => decision.isNew).map((decision) => decision.entry);
    const skipped = decisions.filter((decision) => !decision.isNew).map((decision) => decision.entry);
    const added = decisions.flatMap((decision) => (decision.isNew && decision.key !== null ? [decision.key] : []));
    if (added.length > 0 || memory.keys.length > memorySize) {
      await seenStore.save({
        store: context.store,
        scope,
        name,
        keys: [...memory.keys, ...added].slice(-memorySize),
        previousPageCount: memory.pageCount,
      });
    }
    return {
      items,
      count: items.length,
      skipped,
      skippedCount: skipped.length,
    };
  },
});

function readMemorySize(value: unknown): number {
  if (value === undefined || value === null || value === '') {
    return seenStore.DEFAULT_MEMORY_SIZE;
  }
  const size = values.toNumber(value);
  if (size === null || !Number.isInteger(size) || size < 1) {
    throw new Error('Memory size must be a whole number of 1 or more.');
  }
  return size;
}
