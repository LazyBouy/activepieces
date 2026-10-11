import { t } from 'i18next';
import {
  Braces,
  Brackets,
  ChevronRight,
  CircleSlash,
  Hash,
  LucideIcon,
  ToggleLeft,
  Type,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { TextWithTooltip } from '@/components/custom/text-with-tooltip';
import { VirtualizedList } from '@/components/ui/virtualized-list';
import { cn } from '@/lib/utils';

import { useIsMappingDragSource, useMappingDragSource } from './drag-to-map';
import { SchemaNode, SchemaRow, schemaViewUtils } from './schema-view-utils';
import { ValueKind, viewModeUtils } from './view-mode-utils';

const SchemaView = ({ nodes, draggable, onInsert }: SchemaViewProps) => {
  const [overrides, setOverrides] =
    useState<ReadonlyMap<string, boolean>>(EMPTY_OVERRIDES);
  const rows = useMemo(
    () =>
      schemaViewUtils.flattenRows({
        nodes,
        overrides,
        defaultExpandedDepth: DEFAULT_EXPANDED_DEPTH,
      }),
    [nodes, overrides],
  );
  const setExpanded = ({ id, expanded }: { id: string; expanded: boolean }) =>
    setOverrides((current) => new Map(current).set(id, expanded));

  return (
    <div role="tree" className="flex flex-col">
      <VirtualizedList
        items={rows}
        estimateSize={ROW_HEIGHT}
        getItemKey={(index) => rows[index].node.id}
        renderItem={(row) => (
          <SchemaViewRow
            row={row}
            draggable={draggable}
            onInsert={onInsert}
            onToggle={() =>
              setExpanded({ id: row.node.id, expanded: !row.expanded })
            }
          />
        )}
      />
    </div>
  );
};

const SchemaViewRow = ({
  row,
  draggable,
  onInsert,
  onToggle,
}: SchemaViewRowProps) => {
  const { node, depth, expanded, hasChildren } = row;
  const preview = getPreview(node);
  return (
    <div
      role="treeitem"
      aria-expanded={hasChildren ? expanded : undefined}
      aria-level={depth + 1}
      className="flex h-7 min-w-0 items-center gap-1"
      style={{ paddingLeft: depth * INDENT_PX }}
    >
      {hasChildren ? (
        <button
          type="button"
          aria-label={expanded ? t('Collapse') : t('Expand')}
          onClick={onToggle}
          className="flex size-4 shrink-0 items-center justify-center text-gray-11 hover:text-gray-12"
        >
          <ChevronRight
            className={cn('size-3 transition-transform', {
              'rotate-90': expanded,
            })}
          />
        </button>
      ) : (
        <span aria-hidden className="size-4 shrink-0" />
      )}
      {node.kind === 'group' ? (
        <button
          type="button"
          onClick={onToggle}
          className={cn('truncate text-xs font-medium', {
            'text-success-11': node.tone === 'success',
            'text-danger-11': node.tone === 'danger',
            'text-gray-12': node.tone === 'default',
          })}
        >
          {node.label}
        </button>
      ) : (
        <>
          <SchemaPill node={node} draggable={draggable} onInsert={onInsert} />
          {preview !== '' && (
            <TextWithTooltip tooltipMessage={preview}>
              <span className="ml-1 min-w-0 truncate text-xs text-gray-11">
                {preview}
              </span>
            </TextWithTooltip>
          )}
        </>
      )}
    </div>
  );
};

const SchemaPill = ({
  node,
  draggable,
  onInsert,
}: {
  node: SchemaNode;
  draggable: boolean;
  onInsert?: (propertyPath: string) => void;
}) => {
  const path = draggable ? node.path : null;
  const startDrag = useMappingDragSource(
    path === null ? null : { label: node.label, propertyPath: path },
  );
  const isDragged = useIsMappingDragSource(path);
  const Icon = TYPE_ICONS[viewModeUtils.getValueKind(node.value)];
  const interactive = path !== null;
  return (
    <span
      data-schema-pill
      data-property-path={path ?? undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onPointerDown={startDrag}
      onClick={() => {
        if (path !== null) {
          onInsert?.(path);
        }
      }}
      onKeyDown={(event) => {
        if (path !== null && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onInsert?.(path);
        }
      }}
      className={cn(
        'flex h-6 max-w-[70%] min-w-0 shrink-0 items-center gap-1.5 rounded-sm border border-canvas-pill-border bg-canvas-step px-1.5 text-xs text-gray-12 select-none',
        {
          'cursor-grab hover:border-gray-8 focus-visible:outline-1 focus-visible:outline-focus':
            interactive,
          'border-accent-7 text-accent-9': isDragged,
        },
      )}
    >
      <Icon className="size-3 shrink-0 text-gray-11" />
      <span aria-hidden className="h-3 w-px shrink-0 bg-canvas-pill-border" />
      <span className="truncate">{node.label}</span>
    </span>
  );
};

function getPreview(node: SchemaNode): string {
  if (Array.isArray(node.value)) {
    return t('{count, plural, =1 {1 item} other {# items}}', {
      count: node.value.length,
    });
  }
  if (node.children.length > 0) {
    return '';
  }
  return viewModeUtils.formatPreview(node.value);
}

const TYPE_ICONS: Record<ValueKind, LucideIcon> = {
  string: Type,
  number: Hash,
  boolean: ToggleLeft,
  object: Braces,
  array: Brackets,
  null: CircleSlash,
};

const EMPTY_OVERRIDES: ReadonlyMap<string, boolean> = new Map();
const DEFAULT_EXPANDED_DEPTH = 1;
const INDENT_PX = 24;
const ROW_HEIGHT = 28;

export { SchemaView };

type SchemaViewProps = {
  nodes: SchemaNode[];
  draggable: boolean;
  onInsert?: (propertyPath: string) => void;
};

type SchemaViewRowProps = {
  row: SchemaRow;
  draggable: boolean;
  onInsert?: (propertyPath: string) => void;
  onToggle: () => void;
};
