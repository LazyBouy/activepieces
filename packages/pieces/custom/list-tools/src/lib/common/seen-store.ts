import { Store, StoreScope } from '@activepieces/pieces-framework';
import { values } from './values';

function readMemoryName(value: unknown): string {
  const name = values.readText(value).trim();
  if (name === '') {
    return DEFAULT_MEMORY_NAME;
  }
  if (name.length > MAX_MEMORY_NAME_LENGTH) {
    throw new Error(`Memory name can be at most ${MAX_MEMORY_NAME_LENGTH} characters.`);
  }
  return name;
}

async function load({ store, scope, name }: MemoryLocation): Promise<Memory> {
  const meta = await store.get<unknown>(metaKey(name), scope);
  const pageCount = readPageCount(meta);
  const pages = await Promise.all(
    Array.from({ length: pageCount }, (_, index) => store.get<unknown>(pageKey({ name, index }), scope)),
  );
  const keys = pages.flatMap((page) =>
    Array.isArray(page) ? page.filter((key): key is string => typeof key === 'string') : [],
  );
  return { keys, pageCount };
}

async function save({
  store,
  scope,
  name,
  keys,
  previousPageCount,
}: MemoryLocation & { keys: string[]; previousPageCount: number }): Promise<void> {
  const pages = splitIntoPages(keys);
  await Promise.all(pages.map((page, index) => store.put(pageKey({ name, index }), page, scope)));
  await store.put(metaKey(name), { pages: pages.length }, scope);
  await Promise.all(
    Array.from({ length: Math.max(previousPageCount - pages.length, 0) }, (_, offset) =>
      store.delete(pageKey({ name, index: pages.length + offset }), scope),
    ),
  );
}

async function clear({ store, scope, name }: MemoryLocation): Promise<number> {
  const memory = await load({ store, scope, name });
  await Promise.all(
    Array.from({ length: memory.pageCount }, (_, index) => store.delete(pageKey({ name, index }), scope)),
  );
  await store.delete(metaKey(name), scope);
  return memory.keys.length;
}

function splitIntoPages(keys: string[]): string[][] {
  const pages: string[][] = [];
  let current: string[] = [];
  let currentBytes = 0;
  for (const key of keys) {
    const keyBytes = Buffer.byteLength(JSON.stringify(key), 'utf8') + 1;
    if (current.length > 0 && currentBytes + keyBytes > PAGE_BYTE_BUDGET) {
      pages.push(current);
      current = [];
      currentBytes = 0;
    }
    current.push(key);
    currentBytes += keyBytes;
  }
  return current.length > 0 ? [...pages, current] : pages;
}

function readPageCount(meta: unknown): number {
  if (!values.isRecord(meta)) {
    return 0;
  }
  const pages = meta['pages'];
  return typeof pages === 'number' && Number.isInteger(pages) && pages > 0 ? pages : 0;
}

function metaKey(name: string): string {
  return `${KEY_PREFIX}${name}`;
}

function pageKey({ name, index }: { name: string; index: number }): string {
  return `${KEY_PREFIX}${name}/${index}`;
}

const KEY_PREFIX = 'list-tools/seen/';
const DEFAULT_MEMORY_NAME = 'seen-items';
const MAX_MEMORY_NAME_LENGTH = 60;
const PAGE_BYTE_BUDGET = 400 * 1024;
const DEFAULT_MEMORY_SIZE = 10000;

export const seenStore = {
  readMemoryName,
  load,
  save,
  clear,
  splitIntoPages,
  DEFAULT_MEMORY_NAME,
  DEFAULT_MEMORY_SIZE,
};

export type Memory = {
  keys: string[];
  pageCount: number;
};

export type MemoryLocation = {
  store: Store;
  scope: StoreScope;
  name: string;
};
