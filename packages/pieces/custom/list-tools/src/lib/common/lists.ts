import { values } from './values';

function readList({ value, label }: { value: unknown; label: string }): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().startsWith('[')) {
    const parsed = parseJson(value);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  }
  throw new Error(
    `The ${label} input must be a list (for example a step output that is a list, or JSON text starting with [).`,
  );
}

function readObjects({ value, label }: { value: unknown; label: string }): Record<string, unknown>[] {
  return requireObjects({ list: readList({ value, label }), label });
}

function requireObjects({ list, label }: { list: unknown[]; label: string }): Record<string, unknown>[] {
  return list.map((entry, index) => {
    if (!values.isRecord(entry)) {
      throw new Error(
        `Entry ${index + 1} of the ${label} input is not an object. This action needs a list of objects.`,
      );
    }
    return entry;
  });
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export const lists = {
  readList,
  readObjects,
  requireObjects,
  parseJson,
};
