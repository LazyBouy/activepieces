import { JsonKeyRenderArgs, JsonViewer } from '@/components/custom/json-viewer';
import { cn } from '@/lib/utils';

import { pathHelpers } from '../data-selector/path-helpers';

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
}: DataViewProps) => {
  const draggable = basePath !== null;
  if (mode === 'schema' && schemaNodes.length === 0) {
    return <EmptyDataValue data={data} />;
  }
  if (mode === 'schema') {
    return (
      <div className="px-2 py-1">
        <SchemaView
          nodes={schemaNodes}
          draggable={draggable}
          onInsert={onInsert}
        />
      </div>
    );
  }
  if (mode === 'table') {
    return <TableView data={data} basePath={basePath} />;
  }
  return (
    <div className="px-2 py-1">
      <JsonViewer
        json={data}
        title="json"
        variant="pane"
        renderKey={
          basePath === null
            ? undefined
            : (args) => <DraggableJsonKey {...args} basePath={basePath} />
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
};
