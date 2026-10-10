'use client';

import { apId, isNil, SeekPage } from '@activepieces/core-utils';
import {
  ColumnDef as TanstackColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import React, { useRef, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDeepCompareEffect } from 'react-use';

import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

import { DataFetchErrorState } from '../data-fetch-error-state';

import { DataTableBulkActions } from './data-table-bulk-actions';
import { DataTableColumnHeader } from './data-table-column-header';
import { DataTableFilter, DataTableFilterProps } from './data-table-filter';
import { DataTablePagination } from './data-table-pagination';
import { DataTableSkeleton } from './data-table-skeleton';
import { DataTableToolbar } from './data-table-toolbar';

export type DataWithId = {
  id?: string;
};
export type RowDataWithActions<TData extends DataWithId> = TData & {
  delete: () => void;
  update: (payload: Partial<TData>) => void;
};

export const CURSOR_QUERY_PARAM = 'cursor';
export const LIMIT_QUERY_PARAM = 'limit';

type DataTableAction<TData extends DataWithId> = (
  row: RowDataWithActions<TData>,
) => React.ReactNode;

type ColumnDef<TData, TValue> = TanstackColumnDef<TData, TValue> & {
  notClickable?: boolean;
};

interface DataTableProps<
  TData extends DataWithId,
  TValue,
  Keys extends string,
> {
  columns: ColumnDef<RowDataWithActions<TData>, TValue>[];
  page: SeekPage<TData> | undefined;
  onRowClick?: (
    row: RowDataWithActions<TData>,
    newWindow: boolean,
    e: React.MouseEvent<HTMLTableRowElement, MouseEvent>,
  ) => void;
  isLoading: boolean;
  isError: boolean;
  errorStateEntity: string;
  onRetry?: () => void;
  filters?: DataTableFilters<Keys>[];
  customFilters?: React.ReactNode[];
  onSelectedRowsChange?: (rows: RowDataWithActions<TData>[]) => void;
  actions?: DataTableAction<TData>[];
  hidePagination?: boolean;
  bulkActions?: BulkAction<TData>[];
  toolbarButtons?: React.ReactNode[];
  emptyStateTextTitle: string;
  emptyStateTextDescription: string;
  emptyStateIcon: React.ReactNode;
  emptyStateAction?: React.ReactNode;
  selectColumn?: boolean;
  initialSorting?: SortingState;
  clientPagination?: boolean;
  clientFiltering?: boolean;
  getRowClassName?: (row: RowDataWithActions<TData>, index: number) => string;
  getRowId?: (row: TData) => string;
  isRowSelectionDisabled?: (row: RowDataWithActions<TData>) => boolean;
  virtualizeRows?: boolean;
  bordered?: boolean;
}

export type DataTableFilters<Keys extends string> = DataTableFilterProps & {
  accessorKey: Keys;
};

export type BulkAction<TData extends DataWithId> = {
  render: (
    selectedRows: RowDataWithActions<TData>[],
    resetSelection: () => void,
  ) => React.ReactNode;
};

export function DataTable<
  TData extends DataWithId,
  TValue,
  Keys extends string,
>({
  columns: columnsInitial,
  page,
  onRowClick,
  getRowId,
  filters = [],
  actions = [],
  isLoading,
  isError,
  errorStateEntity,
  onRetry,
  onSelectedRowsChange,
  hidePagination,
  bulkActions = [],
  toolbarButtons,
  emptyStateTextTitle,
  emptyStateTextDescription,
  emptyStateIcon,
  emptyStateAction,
  customFilters,
  selectColumn = false,
  initialSorting = [],
  clientPagination = false,
  clientFiltering = false,
  bordered = true,
  getRowClassName,
  isRowSelectionDisabled,
  virtualizeRows = false,
}: DataTableProps<TData, TValue, Keys>) {
  const selectColumnDef: ColumnDef<RowDataWithActions<TData>, TValue> = {
    id: 'select',
    accessorKey: 'select',
    notClickable: true,
    size: 40,
    minSize: 40,
    maxSize: 40,
    header: ({ table }) => (
      <div className="flex items-center h-full">
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center h-full">
        <Checkbox
          checked={row.getIsSelected()}
          disabled={!row.getCanSelect()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
        />
      </div>
    ),
  };

  const columnsWithSelect = selectColumn
    ? [selectColumnDef, ...columnsInitial]
    : columnsInitial;

  const columns =
    actions.length > 0
      ? columnsWithSelect.concat([
          {
            accessorKey: '__actions',
            size: 60,
            minSize: 60,
            maxSize: 60,
            header: ({ column }) => (
              <DataTableColumnHeader column={column} title="" />
            ),
            cell: ({ row }) => {
              return (
                <div className="flex justify-end gap-4">
                  {actions.map((action, index) => {
                    return (
                      <React.Fragment key={index}>
                        {action(row.original)}
                      </React.Fragment>
                    );
                  })}
                </div>
              );
            },
          },
        ])
      : columnsWithSelect;

  const columnVisibility = columnsInitial.reduce((acc, column) => {
    if (column.enableHiding && 'accessorKey' in column) {
      acc[column.accessorKey as string] = false;
    }
    return acc;
  }, {} as Record<string, boolean>);

  const [searchParams, setSearchParams] = useSearchParams();
  const startingCursor = searchParams.get('cursor') || undefined;
  const startingLimit = searchParams.get('limit') || '10';
  const [currentCursor, setCurrentCursor] = useState<string | undefined>(
    startingCursor,
  );
  const [lastUrlCursor, setLastUrlCursor] = useState(startingCursor);
  if (startingCursor !== lastUrlCursor) {
    setLastUrlCursor(startingCursor);
    setCurrentCursor(startingCursor);
  }
  const [nextPageCursor, setNextPageCursor] = useState<string | undefined>(
    page?.next ?? undefined,
  );
  const [previousPageCursor, setPreviousPageCursor] = useState<
    string | undefined
  >(page?.previous ?? undefined);

  const enrichPageData = (data: TData[]) => {
    return data.map((row, index) => ({
      ...row,
      delete: () => {
        setDeletedRows((prevDeletedRows) => [...prevDeletedRows, row]);
      },
      update: (payload: Partial<TData>) => {
        setTableData((prevData) => {
          const newData = [...prevData];
          newData[index] = { ...newData[index], ...payload };
          return newData;
        });
      },
    }));
  };

  const [deletedRows, setDeletedRows] = useState<TData[]>([]);
  const [tableData, setTableData] = useState<RowDataWithActions<TData>[]>(
    enrichPageData(page?.data ?? []),
  );

  useDeepCompareEffect(() => {
    setNextPageCursor(page?.next ?? undefined);
    setPreviousPageCursor(page?.previous ?? undefined);
    setTableData(enrichPageData(page?.data ?? []));
  }, [page?.data]);

  const table = useReactTable({
    data: tableData,
    columns,
    enableRowSelection: isRowSelectionDisabled
      ? (row) => !isRowSelectionDisabled(row.original)
      : undefined,
    manualPagination: virtualizeRows ? false : !clientPagination,
    manualFiltering: !clientFiltering,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    ...(clientFiltering && { getFilteredRowModel: getFilteredRowModel() }),
    ...((clientPagination || virtualizeRows) && {
      getPaginationRowModel: getPaginationRowModel(),
    }),
    getRowId: getRowId ?? (() => apId()),
    initialState: {
      pagination: {
        pageSize: virtualizeRows
          ? tableData.length || 1000
          : parseInt(startingLimit),
      },
      columnVisibility,
      sorting: initialSorting,
    },
  });

  useEffect(() => {
    filters?.forEach((filter) => {
      const column = table.getColumn(filter.accessorKey);
      if (!column) return;
      if (filter.type === 'input') {
        const value = searchParams.get(filter.accessorKey);
        if (value) column.setFilterValue(value);
      } else {
        const values = searchParams.getAll(filter.accessorKey);
        if (values.length) column.setFilterValue(values);
      }
    });
  }, []);

  const rowSelection = table.getState().rowSelection;
  const selectedRowOriginals = React.useMemo(
    () => table.getSelectedRowModel().rows.map((row) => row.original),
    [rowSelection],
  );
  useEffect(() => {
    onSelectedRowsChange?.(selectedRowOriginals);
  }, [selectedRowOriginals]);

  useEffect(() => {
    if (hidePagination) {
      return;
    }
    setSearchParams(
      (prev) => {
        const newParams = new URLSearchParams(prev);

        if (!isNil(currentCursor) && currentCursor !== '') {
          newParams.set('cursor', currentCursor);
        } else {
          newParams.delete('cursor');
        }
        const pageSize = table.getState().pagination.pageSize;
        if (pageSize) {
          newParams.set('limit', `${pageSize}`);
        }
        return newParams;
      },
      { replace: true },
    );
  }, [currentCursor, table.getState().pagination.pageSize, hidePagination]);

  useEffect(() => {
    setTableData(
      tableData.filter(
        (row) => !deletedRows.some((deletedRow) => deletedRow.id === row.id),
      ),
    );
  }, [deletedRows]);

  const resetSelection = () => {
    table.toggleAllRowsSelected(false);
  };

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const rows = table.getRowModel().rows;
  const isRefreshing = isLoading && rows.length > 0;
  const visibleColumnCount = table.getVisibleLeafColumns().length;
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 49,
    overscan: 15,
    enabled: virtualizeRows,
  });

  return (
    <div
      className={cn(
        virtualizeRows ? 'flex flex-col flex-1 min-h-0' : undefined,
      )}
    >
      {((filters && filters.length > 0) ||
        (customFilters && customFilters.length > 0) ||
        (toolbarButtons && toolbarButtons.length > 0)) && (
        <DataTableToolbar className={bordered ? 'px-0' : undefined}>
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {filters &&
                filters.map((filter) => (
                  <DataTableFilter
                    key={filter.accessorKey}
                    column={table.getColumn(filter.accessorKey)}
                    {...filter}
                  />
                ))}
              {customFilters &&
                customFilters.map((filter, idx) => (
                  <React.Fragment key={idx}>{filter}</React.Fragment>
                ))}
            </div>
            {toolbarButtons && toolbarButtons.length > 0 && (
              <div className="flex items-center gap-2">
                {toolbarButtons.map((button, idx) => (
                  <React.Fragment key={idx}>{button}</React.Fragment>
                ))}
              </div>
            )}
          </div>
        </DataTableToolbar>
      )}

      <div
        ref={scrollContainerRef}
        className={cn(
          'relative mt-0',
          {
            'overflow-hidden': !virtualizeRows,
            'flex-1 min-h-0 overflow-auto': virtualizeRows,
          },
          bordered &&
            'rounded-lg border bg-panel [&_thead]:border-t-0 [&_tbody>tr:last-child]:border-b-0',
        )}
      >
        {isRefreshing && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-9 z-20 h-0.5 overflow-hidden"
          >
            <div className="h-full w-1/4 animate-indeterminate-progress bg-accent-9 motion-reduce:w-full" />
          </div>
        )}
        <Table
          className="table-fixed"
          containerClassName={cn(virtualizeRows && 'overflow-visible')}
        >
          <TableHeader
            className={cn(
              virtualizeRows && STICKY_HEADER_CLASS_NAME,
              virtualizeRows &&
                bordered &&
                'shadow-[inset_0_-1px_0_var(--gray-6)]',
            )}
          >
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => {
                  const size = header.column.columnDef.size;
                  return (
                    <TableHead
                      key={header.id}
                      style={
                        size
                          ? { width: size, minWidth: size, maxWidth: size }
                          : undefined
                      }
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody
            className={cn('transition-opacity', isRefreshing && 'opacity-38')}
          >
            {isLoading && !isRefreshing ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={visibleColumnCount}
                  className="h-auto p-0 first:pl-0 last:pr-0"
                >
                  <DataTableSkeleton
                    skeletonRowCount={Math.min(
                      table.getState().pagination.pageSize,
                      MAX_SKELETON_ROWS,
                    )}
                  />
                </TableCell>
              </TableRow>
            ) : rows.length ? (
              virtualizeRows ? (
                <>
                  {virtualizer.getVirtualItems().length > 0 && (
                    <tr>
                      <td
                        colSpan={visibleColumnCount}
                        style={{
                          height: virtualizer.getVirtualItems()[0].start,
                        }}
                      />
                    </tr>
                  )}
                  {virtualizer.getVirtualItems().map((virtualRow) => {
                    const row = rows[virtualRow.index];
                    const rowIndex = virtualRow.index;
                    return (
                      <TableRow
                        key={row.id}
                        data-index={virtualRow.index}
                        className={cn(
                          'cursor-pointer',
                          {
                            'hover:bg-transparent cursor-default':
                              isNil(onRowClick),
                          },
                          getRowClassName?.(row.original, rowIndex),
                        )}
                        onClick={(e) => {
                          const clickedCellIndex = (
                            e.target as HTMLElement
                          ).closest('td')?.cellIndex;
                          if (
                            clickedCellIndex !== undefined &&
                            columns[clickedCellIndex]?.notClickable
                          ) {
                            return;
                          }
                          onRowClick?.(row.original, e.ctrlKey || e.metaKey, e);
                        }}
                        onAuxClick={(e) => {
                          const clickedCellIndex = (
                            e.target as HTMLElement
                          ).closest('td')?.cellIndex;
                          if (
                            clickedCellIndex !== undefined &&
                            columns[clickedCellIndex]?.notClickable
                          ) {
                            return;
                          }
                          onRowClick?.(row.original, true, e);
                        }}
                        data-state={row.getIsSelected() && 'selected'}
                      >
                        {row.getVisibleCells().map((cell) => {
                          const size = cell.column.columnDef.size;
                          return (
                            <TableCell
                              key={cell.id}
                              style={
                                size
                                  ? {
                                      width: size,
                                      minWidth: size,
                                      maxWidth: size,
                                    }
                                  : undefined
                              }
                            >
                              <div
                                className={cn('flex w-full items-center', {
                                  'justify-end': cell.column.id === 'actions',
                                  'justify-start': cell.column.id !== 'actions',
                                })}
                              >
                                <div
                                  className="w-full"
                                  onClick={(e) => {
                                    if (cell.column.id === 'select') {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      return;
                                    }
                                  }}
                                >
                                  {flexRender(
                                    cell.column.columnDef.cell,
                                    cell.getContext(),
                                  )}
                                </div>
                              </div>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}
                  {virtualizer.getVirtualItems().length > 0 && (
                    <tr>
                      <td
                        colSpan={visibleColumnCount}
                        style={{
                          height:
                            virtualizer.getTotalSize() -
                            (virtualizer.getVirtualItems().at(-1)?.end ?? 0),
                        }}
                      />
                    </tr>
                  )}
                </>
              ) : (
                rows.map((row, rowIndex) => (
                  <TableRow
                    className={cn(
                      'cursor-pointer',
                      {
                        'hover:bg-transparent cursor-default':
                          isNil(onRowClick),
                      },
                      getRowClassName?.(row.original, rowIndex),
                    )}
                    onClick={(e) => {
                      const clickedCellIndex = (
                        e.target as HTMLElement
                      ).closest('td')?.cellIndex;
                      if (
                        clickedCellIndex !== undefined &&
                        columns[clickedCellIndex]?.notClickable
                      ) {
                        return;
                      }
                      onRowClick?.(row.original, e.ctrlKey || e.metaKey, e);
                    }}
                    onAuxClick={(e) => {
                      const clickedCellIndex = (
                        e.target as HTMLElement
                      ).closest('td')?.cellIndex;
                      if (
                        clickedCellIndex !== undefined &&
                        columns[clickedCellIndex]?.notClickable
                      ) {
                        return;
                      }
                      onRowClick?.(row.original, true, e);
                    }}
                    key={row.id}
                    data-state={row.getIsSelected() && 'selected'}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const size = cell.column.columnDef.size;
                      return (
                        <TableCell
                          key={cell.id}
                          style={
                            size
                              ? {
                                  width: size,
                                  minWidth: size,
                                  maxWidth: size,
                                }
                              : undefined
                          }
                        >
                          <div
                            className={cn('flex w-full items-center', {
                              'justify-end': cell.column.id === 'actions',
                              'justify-start': cell.column.id !== 'actions',
                            })}
                          >
                            <div
                              className="w-full"
                              onClick={(e) => {
                                if (cell.column.id === 'select') {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  return;
                                }
                              }}
                            >
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext(),
                              )}
                            </div>
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))
              )
            ) : isError ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={visibleColumnCount} className="h-auto">
                  <DataFetchErrorState
                    entity={errorStateEntity}
                    onRetry={onRetry}
                    className="min-h-80"
                  />
                </TableCell>
              </TableRow>
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={visibleColumnCount} className="h-auto">
                  <div className="flex min-h-80 flex-col items-center justify-center px-4 py-10 text-center">
                    {emptyStateIcon && (
                      <div className="flex text-gray-10 [&_svg]:size-10 [&_svg]:stroke-[1.5] [&_svg]:text-gray-10">
                        {emptyStateIcon}
                      </div>
                    )}
                    <p className="mt-2 text-base font-medium text-gray-12">
                      {emptyStateTextTitle}
                    </p>
                    {emptyStateTextDescription && (
                      <p className="mt-2 max-w-lg text-sm text-gray-11">
                        {emptyStateTextDescription}
                      </p>
                    )}
                    {emptyStateAction && (
                      <div className="mt-5">{emptyStateAction}</div>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {!hidePagination && !virtualizeRows && (
        <DataTablePagination
          className="mt-4 mb-6"
          pageSize={table.getState().pagination.pageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          onPageSizeChange={(size) => {
            table.setPageSize(size);
            if (!clientPagination) {
              setCurrentCursor(undefined);
            }
          }}
          canPrevious={
            clientPagination ? table.getCanPreviousPage() : !!previousPageCursor
          }
          canNext={clientPagination ? table.getCanNextPage() : !!nextPageCursor}
          onPrevious={() => {
            if (clientPagination) {
              table.previousPage();
            } else {
              setCurrentCursor(previousPageCursor);
            }
          }}
          onNext={() => {
            if (clientPagination) {
              table.nextPage();
            } else {
              setCurrentCursor(nextPageCursor);
            }
          }}
        />
      )}
      {bulkActions.length > 0 && (
        <DataTableBulkActions
          selectedRows={selectedRowOriginals}
          actions={bulkActions}
          resetSelection={resetSelection}
        />
      )}
    </div>
  );
}

const PAGE_SIZE_OPTIONS = [10, 30, 50];
const MAX_SKELETON_ROWS = 10;

const STICKY_HEADER_CLASS_NAME =
  'sticky top-0 z-10 border-t-0 bg-gray-3 shadow-[inset_0_1px_0_var(--gray-6),inset_0_-1px_0_var(--gray-6)] [&>tr]:border-b-0';
