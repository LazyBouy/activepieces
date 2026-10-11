import { isNil } from '@activepieces/core-utils';

import { DataSelectorTreeNode } from '../data-selector/type';

function fromDataSelectorNodes({
  nodes,
  parentId,
}: {
  nodes: DataSelectorTreeNode[];
  parentId?: string;
}): SchemaNode[] {
  const occurrences = new Map<string, number>();
  return nodes
    .filter((node) => node.data.type !== 'test')
    .map((node): SchemaNode => {
      const seen = occurrences.get(node.key) ?? 0;
      occurrences.set(node.key, seen + 1);
      const segment = encodeURIComponent(node.key);
      const localId = seen === 0 ? segment : `${segment}#${seen}`;
      const id = isNil(parentId) ? localId : `${parentId}/${localId}`;
      const children = fromDataSelectorNodes({
        nodes: node.children ?? [],
        parentId: id,
      });
      if (node.data.type === 'chunk') {
        return {
          id,
          kind: 'group',
          label: node.data.displayName,
          value: undefined,
          path: null,
          tone: getTone(node.data.displayNameClassName),
          children,
        };
      }
      if (node.data.type !== 'value') {
        return {
          id,
          kind: 'group',
          label: '',
          value: undefined,
          path: null,
          tone: 'default',
          children,
        };
      }
      return {
        id,
        kind: 'field',
        label: node.data.displayName,
        value: node.data.value,
        path:
          node.data.insertable && !node.isLoopStepNode
            ? node.data.propertyPath
            : null,
        tone: 'default',
        children,
      };
    });
}

function flattenRows({
  nodes,
  overrides,
  defaultExpandedDepth,
  depth = 0,
}: {
  nodes: SchemaNode[];
  overrides: ReadonlyMap<string, boolean>;
  defaultExpandedDepth: number;
  depth?: number;
}): SchemaRow[] {
  return nodes.flatMap((node) => {
    const hasChildren = node.children.length > 0;
    const expanded =
      hasChildren && (overrides.get(node.id) ?? depth < defaultExpandedDepth);
    const row: SchemaRow = { node, depth, expanded, hasChildren };
    if (!expanded) {
      return [row];
    }
    return [
      row,
      ...flattenRows({
        nodes: node.children,
        overrides,
        defaultExpandedDepth,
        depth: depth + 1,
      }),
    ];
  });
}

function rootChildren(root: DataSelectorTreeNode): DataSelectorTreeNode[] {
  if (root.children && root.children.length > 0) {
    return root.children;
  }
  return [];
}

function getTone(className: string | undefined): SchemaNode['tone'] {
  if (className?.includes('success')) {
    return 'success';
  }
  if (className?.includes('danger')) {
    return 'danger';
  }
  return 'default';
}

export const schemaViewUtils = {
  fromDataSelectorNodes,
  flattenRows,
  rootChildren,
};

export type SchemaNode = {
  id: string;
  kind: 'field' | 'group';
  label: string;
  value: unknown;
  path: string | null;
  tone: 'default' | 'success' | 'danger';
  children: SchemaNode[];
};

export type SchemaRow = {
  node: SchemaNode;
  depth: number;
  expanded: boolean;
  hasChildren: boolean;
};
