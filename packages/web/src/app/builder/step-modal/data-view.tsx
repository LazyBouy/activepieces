import { JsonKeyRenderArgs, JsonViewer } from '@/components/custom/json-viewer';
import { cn } from '@/lib/utils';

import { pathHelpers } from '../data-selector/path-helpers';

import { DataPaneNoMatches } from './data-pane';
import { dataSearchUtils } from './data-search-utils';
import { useIsMappingDragSource, useMappingDragSource } from './drag-to-map';
import { SchemaView } from './schema-view';
import { SchemaNode } from './schema-view-utils';
import { EmptyDataValue, TableView } from './table-view';
import { ViewMode } from './view-mode-utils';

const DataView = ({
  mode,
  data,
  schemaNodes,
  basePath,
  onInsert,
  query = '',
  isReferenced,
}: DataViewProps) => {
  const searching = dataSearchUtils.isActive(query);
  if (mode === 'schema') {
    const nodes = dataSearchUtils.filterSchemaNodes({
      nodes: schemaNodes,
      query,
    });
    if (searching && nodes.length === 0) {
      return <DataPaneNoMatches />;
    }
    if (nodes.length === 0) {
      return <EmptyDataValue data={data} />;
    }
    return (
      <div className="px-2 py-1">
        <SchemaView
          nodes={nodes}
          draggable={basePath !== null}
          onInsert={onInsert}
          expandAll={searching}
          isReferenced={isReferenced}
        />
      </div>
    );
  }
  const pruned = dataSearchUtils.pruneData({ value: data, query });
  if (!pruned.matched) {
    return <DataPaneNoMatches />;
  }
  const mappingPath = searching ? null : basePath;
  if (mode === 'table') {
    return <TableView data={pruned.value} basePath={mappingPath} />;
  }
  return (
    <div className="px-2 py-1">
      <JsonViewer
        json={pruned.value}
        title="json"
        variant="pane"
        renderKey={
          mappingPath === null
            ? undefined
            : (args) => <DraggableJsonKey {...args} basePath={mappingPath} />
        }
      />
    </div>
  );
};

const DraggableJsonKey = ({
  keyLabel,
  path,
  basePath,
}: JsonKeyRenderArgs & { basePath: string }) => {
  const propertyPath = pathHelpers.appendSegmentsToPropertyPath({
    basePath,
    segments: path,
  });
  const startDrag = useMappingDragSource({ label: keyLabel, propertyPath });
  const isDragged = useIsMappingDragSource(propertyPath);
  return (
    <span
      data-json-key
      data-property-path={propertyPath}
      onPointerDown={startDrag}
      className={cn('cursor-grab text-canvas-json-key select-none', {
        'text-accent-9': isDragged,
      })}
    >
      {keyLabel}
    </span>
  );
};

export { DataView };

type DataViewProps = {
  mode: ViewMode;
  data: unknown;
  schemaNodes: SchemaNode[];
  basePath: string | null;
  onInsert?: (propertyPath: string) => void;
  query?: string;
  isReferenced?: (propertyPath: string) => boolean;
};
