import { values } from './values';

function parse(text: string): string[] {
  const trimmed = text.trim();
  return trimmed === '' ? [] : trimmed.split('.');
}

function parseList(text: string): string[][] {
  return text
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '')
    .map(parse);
}

function toName(text: string): string {
  return text.trim().split('.').join('_');
}

function read({ value, path }: { value: unknown; path: string[] }): unknown {
  return path.reduce<unknown>((current, segment) => readSegment({ value: current, segment }), value);
}

function write({ target, path, value }: { target: unknown; path: string[]; value: unknown }): unknown {
  if (path.length === 0) {
    return value;
  }
  const [head, ...rest] = path;
  if (Array.isArray(target) && INDEX_SEGMENT.test(head)) {
    const index = Number(head);
    return Array.from({ length: Math.max(target.length, index + 1) }, (_, position) =>
      position === index ? write({ target: target[position], path: rest, value }) : target[position],
    );
  }
  const record = values.isRecord(target) ? target : {};
  const current = values.hasOwn({ record, key: head }) ? record[head] : undefined;
  return withEntry({ record, key: head, value: write({ target: current, path: rest, value }) });
}

function remove({ target, path }: { target: unknown; path: string[] }): unknown {
  if (path.length === 0) {
    return target;
  }
  const [head, ...rest] = path;
  if (Array.isArray(target)) {
    if (!INDEX_SEGMENT.test(head) || Number(head) >= target.length) {
      return target;
    }
    const index = Number(head);
    return rest.length === 0
      ? target.filter((_, position) => position !== index)
      : target.map((item, position) => (position === index ? remove({ target: item, path: rest }) : item));
  }
  if (!values.isRecord(target) || !values.hasOwn({ record: target, key: head })) {
    return target;
  }
  if (rest.length === 0) {
    return Object.fromEntries(Object.entries(target).filter(([key]) => key !== head));
  }
  return withEntry({ record: target, key: head, value: remove({ target: target[head], path: rest }) });
}

function removeAll({ target, paths }: { target: unknown; paths: string[][] }): unknown {
  return paths.reduce((current, path) => remove({ target: current, path }), target);
}

function removeAndPrune({ target, path }: { target: unknown; path: string[] }): unknown {
  const removed = remove({ target, path });
  if (path.length <= 1 || removed === target) {
    return removed;
  }
  const parentPath = path.slice(0, -1);
  const parent = read({ value: removed, path: parentPath });
  if (values.isRecord(parent) && Object.keys(parent).length === 0) {
    return removeAndPrune({ target: removed, path: parentPath });
  }
  return removed;
}

function removeAllAndPrune({ target, paths }: { target: unknown; paths: string[][] }): unknown {
  return paths.reduce((current, path) => removeAndPrune({ target: current, path }), target);
}

function pick({ source, paths }: { source: Record<string, unknown>; paths: string[][] }): Record<string, unknown> {
  const entries = Object.entries(source).flatMap(([key, value]): [string, unknown][] => {
    const matching = paths.filter((path) => path[0] === key);
    if (matching.length === 0) {
      return [];
    }
    if (matching.some((path) => path.length === 1)) {
      return [[key, value]];
    }
    const nested = matching.map((path) => path.slice(1));
    if (values.isRecord(value)) {
      return [[key, pick({ source: value, paths: nested })]];
    }
    if (Array.isArray(value)) {
      return [[key, pickFromList({ list: value, paths: nested })]];
    }
    return [];
  });
  return Object.fromEntries(entries);
}

function withEntry({
  record,
  key,
  value,
}: {
  record: Record<string, unknown>;
  key: string;
  value: unknown;
}): Record<string, unknown> {
  if (!values.hasOwn({ record, key })) {
    return Object.fromEntries([...Object.entries(record), [key, value]]);
  }
  return Object.fromEntries(
    Object.entries(record).map(([currentKey, currentValue]) => [
      currentKey,
      currentKey === key ? value : currentValue,
    ]),
  );
}

function readSegment({ value, segment }: { value: unknown; segment: string }): unknown {
  if (Array.isArray(value)) {
    return INDEX_SEGMENT.test(segment) ? value[Number(segment)] : undefined;
  }
  if (values.isRecord(value) && values.hasOwn({ record: value, key: segment })) {
    return value[segment];
  }
  return undefined;
}

function pickFromList({ list, paths }: { list: unknown[]; paths: string[][] }): unknown[] {
  return list.flatMap((item, position) => {
    const matching = paths.filter((path) => path[0] === String(position));
    if (matching.length === 0) {
      return [];
    }
    if (matching.some((path) => path.length === 1)) {
      return [item];
    }
    return values.isRecord(item) ? [pick({ source: item, paths: matching.map((path) => path.slice(1)) })] : [];
  });
}

const INDEX_SEGMENT = /^\d+$/;

export const paths = {
  parse,
  parseList,
  toName,
  read,
  write,
  remove,
  removeAll,
  removeAllAndPrune,
  pick,
  withEntry,
};
