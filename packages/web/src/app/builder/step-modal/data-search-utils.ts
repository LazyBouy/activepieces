import { SchemaNode } from './schema-view-utils';

function normalize(query: string): string {
  return query.trim().toLowerCase();
}

function isActive(query: string): boolean {
  return normalize(query) !== '';
}

function pruneData({
  value,
  query,
}: {
  value: unknown;
  query: string;
}): Pruned {
  const needle = normalize(query);
  if (needle === '') {
    return { matched: true, value };
  }
  return prune({ value, needle });
}

function prune({ value, needle }: { value: unknown; needle: string }): Pruned {
  if (Array.isArray(value)) {
    const kept = value
      .map((item) => prune({ value: item, needle }))
      .filter((result) => result.matched)
      .map((result) => result.value);
    return { matched: kept.length > 0, value: kept };
  }
  if (isRecord(value)) {
    const entries = Object.entries(value).flatMap(
      ([key, child]): [string, unknown][] => {
        if (includes({ text: key, needle })) {
          return [[key, child]];
        }
        const result = prune({ value: child, needle });
        return result.matched ? [[key, result.value]] : [];
      },
    );
    return { matched: entries.length > 0, value: Object.fromEntries(entries) };
  }
  return { matched: includes({ text: textOf(value), needle }), value };
}

function filterSchemaNodes({
  nodes,
  query,
}: {
  nodes: SchemaNode[];
  query: string;
}): SchemaNode[] {
  const needle = normalize(query);
  if (needle === '') {
    return nodes;
  }
  return filterNodes({ nodes, needle });
}

function filterNodes({
  nodes,
  needle,
}: {
  nodes: SchemaNode[];
  needle: string;
}): SchemaNode[] {
  return nodes.flatMap((node) => {
    if (node.kind === 'field' && nodeMatches({ node, needle })) {
      return [node];
    }
    const children = filterNodes({ nodes: node.children, needle });
    return children.length > 0 ? [{ ...node, children }] : [];
  });
}

function nodeMatches({
  node,
  needle,
}: {
  node: SchemaNode;
  needle: string;
}): boolean {
  if (includes({ text: node.label, needle })) {
    return true;
  }
  return (
    node.children.length === 0 &&
    !isRecord(node.value) &&
    !Array.isArray(node.value) &&
    includes({ text: textOf(node.value), needle })
  );
}

function includes({ text, needle }: { text: string; needle: string }): boolean {
  return text.toLowerCase().includes(needle);
}

function textOf(value: unknown): string {
  if (value === null || value === undefined) {
    return String(value);
  }
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export const dataSearchUtils = {
  isActive,
  pruneData,
  filterSchemaNodes,
};

export type Pruned = { matched: boolean; value: unknown };
