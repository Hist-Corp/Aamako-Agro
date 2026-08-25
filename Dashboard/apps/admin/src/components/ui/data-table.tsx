'use client';

import React, { useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from '@tanstack/react-table';
import { cn } from '@/lib/utils';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { Button } from './button';

interface DataTableProps<TData> {
  columns: ColumnDef<TData, any>[];
  data: TData[];
  /** Enable built-in pagination */
  pagination?: boolean;
  /** Enable built-in search filter */
  searchPlaceholder?: string;
  /** Custom filter slot (e.g., status filter tabs, date range) */
  filterSlot?: React.ReactNode;
  /** Row click handler */
  onRowClick?: (row: TData) => void;
  /** Empty state */
  emptyState?: React.ReactNode;
  /** Loading state */
  isLoading?: boolean;
  /** Total count from server (for server-side pagination) */
  totalCount?: number;
  /** Currently selected rows (controlled) */
  selectedRowIds?: string[];
  /** Row selection handler */
  onRowSelect?: (ids: string[]) => void;
  /** Selection column */
  enableSelection?: boolean;
  className?: string;
}

export function DataTable<TData>({
  columns,
  data,
  pagination = true,
  searchPlaceholder,
  filterSlot,
  onRowClick,
  emptyState,
  isLoading,
  selectedRowIds,
  onRowSelect,
  enableSelection = false,
  className,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = React.useState('');
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

  const allColumns = useMemo<ColumnDef<TData, any>[]>(() => {
    if (!enableSelection) return columns;
    return [
      {
        id: 'select',
        header: ({ table }) => (
          <input
            type="checkbox"
            className="rounded border-surface-300 text-brand-600 focus:ring-brand-500"
            checked={table.getIsAllPageRowsSelected()}
            onChange={(e) => table.toggleAllPageRowsSelected(e.target.checked)}
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            className="rounded border-surface-300 text-brand-600 focus:ring-brand-500"
            checked={row.getIsSelected()}
            onChange={(e) => row.toggleSelected(e.target.checked)}
          />
        ),
        size: 40,
        enableSorting: false,
        enableHiding: false,
      },
      ...columns,
    ];
  }, [columns, enableSelection]);

  const table = useReactTable({
    data,
    columns: allColumns,
    state: {
      sorting,
      globalFilter,
      columnFilters,
      ...(enableSelection && selectedRowIds
        ? {
            rowSelection: Object.fromEntries(
              data
                .map((row, idx) => [
                  idx,
                  selectedRowIds.includes((row as any).id),
                ])
                .filter(([_, selected]) => selected)
            ),
          }
        : {}),
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: (updater) => {
      if (!onRowSelect) return;
      const newSelection =
        typeof updater === 'function'
          ? updater(
              Object.fromEntries(
                data.map((row, idx) => [
                  idx,
                  selectedRowIds?.includes((row as any).id) ?? false,
                ])
              )
            )
          : updater;
      const ids = Object.entries(newSelection)
        .filter(([_, selected]) => selected)
        .map(([idx]) => (data[parseInt(idx)] as any).id);
      onRowSelect(ids);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: pagination ? getPaginationRowModel() : undefined,
    initialState: {
      pagination: { pageSize: 25 },
    },
  });

  return (
    <div className={cn('table-container', className)}>
      {/* Filter bar */}
      {(searchPlaceholder || filterSlot) && (
        <div className="filter-bar">
          {searchPlaceholder && (
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={globalFilter ?? ''}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="h-8 w-64 rounded-lg border border-surface-200 bg-white px-3 text-sm text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            />
          )}
          {filterSlot}
        </div>
      )}

      {/* Selection summary */}
      {enableSelection && selectedRowIds && selectedRowIds.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 bg-brand-50 border-b border-brand-200 text-sm text-brand-700">
          <span className="font-medium">{selectedRowIds.length} selected</span>
          <button
            onClick={() => onRowSelect?.([])}
            className="text-brand-600 hover:text-brand-800 underline"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-surface-200 bg-surface-50">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className={cn(
                      'px-4 py-2.5 text-left text-xs font-semibold text-surface-500 uppercase tracking-wider',
                      header.column.getCanSort() && 'cursor-pointer select-none hover:text-surface-700'
                    )}
                    style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && (
                        <span className="text-surface-400">
                          {header.column.getIsSorted() === 'asc' ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : header.column.getIsSorted() === 'desc' ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronsUpDown className="h-3 w-3" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading ? (
              // Loading state
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`loading-${i}`} className="border-b border-surface-100">
                  {allColumns.map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="skeleton h-4 rounded w-3/4" />
                    </td>
                  ))}
                </tr>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={allColumns.length}>
                  {emptyState ?? (
                    <div className="py-12 text-center text-sm text-surface-500">
                      No results found.
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    'border-b border-surface-100 transition-colors',
                    onRowClick && 'cursor-pointer hover:bg-surface-50',
                    row.getIsSelected() && 'bg-brand-50/50'
                  )}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-2.5 text-surface-700">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && table.getPageCount() > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-surface-200">
          <p className="text-xs text-surface-500">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </p>
          <div className="flex gap-1">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
