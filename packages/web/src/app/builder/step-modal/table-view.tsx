import { t } from 'i18next';
import { useMemo } from 'react';

import { VirtualizedList } from '@/components/ui/virtualized-list';
import { cn } from '@/lib/utils';

import { useIsMappingDragSource, useMappingDragSource } from './drag-to-map';
import { TableModel, viewModeUtils } from './view-mode-utils';

const TableView = ({ data, basePath }: TableViewProps) => {
  const model = useMemo(() => viewModeUtils.buildTableModel(data), [data]);
  if (model.kind === 'empty') {
    return <EmptyDataValue data={data} />;
  }
  const gridTemplateColumns = `repeat(${model.columns.length}, minmax(${COLUMN_MIN_WIDTH}px, 1fr))`;
  return (
    <div className="px-3 pb-3">
      <div
        role="table"
        aria-rowcount={model.rows.length + 1}
        className="min-w-fit border-t border-l border-canvas-table-line text-xs text-gray-12"
      >
        <div
          role="row"
          className="sticky top-0 z-10 grid bg-canvas-data-pane"
          style={{ gridTemplateColumns }}
        >
          {model.columns.map((column, columnIndex) => (
            <TableHeaderCell
              key={column}
              label={
                column === viewModeUtils.VALUE_COLUMN ? t('Value') : column
              }
              path={
                basePath === null
                  ? null
                  : viewModeUtils.getColumnPath({
                      basePath,
                      model,
                      columnIndex,
                    })
              }
            />
          ))}
        </div>
        <VirtualizedList
          items={model.rows}
          estimateSize={ROW_HEIGHT}
          getItemKey={(index) => index}
          renderItem={(row) => (
            <TableBodyRow
              row={row}
              gridTemplateColumns={gridTemplateColumns}
              model={model}
            />
          )}
        />
      </div>
    </div>
  );
};

const EmptyDataValue = ({ data }: { data: unknown }) => (
  <div className="px-3 py-2 font-mono text-xs text-gray-11">
    {viewModeUtils.formatCell(data) || 'null'}
  </div>
);

const TableHeaderCell = ({
  label,
  path,
}: {
  label: string;
  path: string | null;
}) => {
  const startDrag = useMappingDragSource(
    path === null ? null : { label, propertyPath: path },
  );
  const isDragged = useIsMappingDragSource(path);
  return (
    <div
      role="columnheader"
      data-property-path={path ?? undefined}
      onPointerDown={startDrag}
      className={cn(
        'flex h-8 min-w-0 items-center border-r border-b border-canvas-table-line px-1.5 py-1 font-semibold select-none',
        {
          'cursor-grab hover:bg-canvas-table-header-hover': path !== null,
          'text-accent-9': isDragged,
        },
      )}
    >
      <span className="truncate">{label}</span>
    </div>
  );
};

const TableBodyRow = ({
  row,
  gridTemplateColumns,
  model,
}: {
  row: unknown[];
  gridTemplateColumns: string;
  model: TableModel;
}) => (
  <div role="row" className="grid" style={{ gridTemplateColumns }}>
    {model.columns.map((column, index) => {
      const text = viewModeUtils.formatCell(row[index]);
      return (
        <div
          key={column}
          role="cell"
          title={text}
          className="h-6.5 min-w-0 truncate border-r border-b border-canvas-table-line px-1.5 py-1 leading-4.5"
        >
          {text}
        </div>
      );
    })}
  </div>
);

const COLUMN_MIN_WIDTH = 120;
const ROW_HEIGHT = 26;

export { TableView, EmptyDataValue };

type TableViewProps = {
  data: unknown;
  basePath: string | null;
};
