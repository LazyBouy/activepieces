import { pieceTranslation } from '@activepieces/pieces-framework';
import { gzip } from '../src';

function collectDisplayStrings(): string[] {
  const metadata = gzip.metadata();
  const fromPaths = pieceTranslation.pathsToValuesToTranslate.flatMap((path) =>
    collect({ value: metadata, keys: path.split('.') }),
  );
  const connectionName = collect({ value: metadata, keys: ['auth', 'displayName'] });
  return [...new Set([metadata.displayName, ...connectionName, ...fromPaths])].filter((text) => text !== '');
}

function collect({ value, keys }: { value: unknown; keys: string[] }): string[] {
  if (keys.length === 0) {
    return typeof value === 'string' ? [value] : [];
  }
  if (typeof value !== 'object' || value === null) {
    return [];
  }
  const [head, ...rest] = keys;
  if (head === '*') {
    return Object.values(value).flatMap((child) => collect({ value: child, keys: rest }));
  }
  return collect({ value: Object.getOwnPropertyDescriptor(value, head)?.value, keys: rest });
}

export const displayStrings = {
  collectDisplayStrings,
};
