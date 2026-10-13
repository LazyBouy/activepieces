import { Store, StoreScope } from '@activepieces/pieces-framework';

function createMemoryStore(): MemoryStore {
  const entries = new Map<string, string>();
  const fullKey = ({ key, scope }: { key: string; scope?: StoreScope }) => `${scope ?? StoreScope.FLOW}|${key}`;
  const store: Store = {
    async put(key, value, scope) {
      entries.set(fullKey({ key, scope }), JSON.stringify(value));
      return value;
    },
    async get(key, scope) {
      const raw = entries.get(fullKey({ key, scope }));
      return raw === undefined ? null : JSON.parse(raw);
    },
    async delete(key, scope) {
      entries.delete(fullKey({ key, scope }));
    },
  };
  return { store, entries };
}

function range(count: number): number[] {
  return Array.from({ length: count }, (_, index) => index);
}

export const testUtils = {
  createMemoryStore,
  range,
};

export type MemoryStore = {
  store: Store;
  entries: Map<string, string>;
};
