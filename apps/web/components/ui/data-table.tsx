"use client";

import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
} from "@tanstack/react-table";
import { useState, useMemo } from "react";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  Search,
  RotateCw,
  Printer,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "./empty-state";
import { SkeletonTable } from "./skeleton";

export interface FilterField {
  id: string;
  label: string;
  options: { label: string; value: any }[];
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  isLoading?: boolean;
  searchPlaceholder?: string;
  searchColumn?: string;
  filterBar?: React.ReactNode;
  filterFields?: FilterField[];
  onRowClick?: (row: TData) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  pageSize?: number;
  globalFilter?: string;
  onGlobalFilterChange?: (value: string) => void;
  columnFilters?: ColumnFiltersState;
  onColumnFiltersChange?: (value: ColumnFiltersState) => void;
  onRefresh?: () => void;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  isLoading,
  searchPlaceholder = "Search…",
  searchColumn,
  filterBar,
  filterFields,
  onRowClick,
  emptyTitle = "No data found",
  emptyDescription = "Try adjusting your search or filters",
  pageSize = 15,
  globalFilter,
  onGlobalFilterChange,
  columnFilters,
  onColumnFiltersChange,
  onRefresh,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [localColumnFilters, setLocalColumnFilters] = useState<ColumnFiltersState>([]);
  const [localGlobalFilter, setLocalGlobalFilter] = useState("");
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const gFilter = globalFilter !== undefined ? globalFilter : localGlobalFilter;
  const setGFilter = onGlobalFilterChange || setLocalGlobalFilter;

  const colFilters = columnFilters !== undefined ? columnFilters : localColumnFilters;
  const setColFilters = onColumnFiltersChange || setLocalColumnFilters;

  // Inject custom array-aware filterFn for columns in filterFields
  const processedColumns = useMemo(() => {
    return columns.map((col) => {
      const colId = col.id || (col as any).accessorKey;
      const isFilterable = filterFields?.some((f) => f.id === colId);
      if (isFilterable) {
        return {
          ...col,
          filterFn: (row: any, columnId: string, filterValue: any) => {
            if (!filterValue || filterValue.length === 0) return true;
            const rowValue = row.getValue(columnId);
            if (Array.isArray(filterValue)) {
              return filterValue.includes(rowValue);
            }
            return String(rowValue).toLowerCase().includes(String(filterValue).toLowerCase());
          },
        };
      }
      return col;
    });
  }, [columns, filterFields]);

  const table = useReactTable({
    data,
    columns: processedColumns,
    state: {
      sorting,
      columnFilters: colFilters,
      globalFilter: gFilter,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: (updater) => {
      const next = typeof updater === "function" ? updater(colFilters) : updater;
      setColFilters(next);
    },
    onGlobalFilterChange: setGFilter,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: (onGlobalFilterChange || onColumnFiltersChange) ? undefined : getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  if (isLoading) return <SkeletonTable rows={pageSize > 10 ? 8 : pageSize} />;

  return (
    <div className="space-y-3">
      {/* Search + filter bar */}
      <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
        <div className="flex flex-1 flex-wrap gap-2 items-center w-full max-w-full">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={gFilter}
              onChange={(e) => setGFilter(e.target.value)}
              className="w-full h-9 pl-9 pr-4 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
            />
          </div>

          {/* Render built-in multi filters */}
          {filterFields && filterFields.length > 0 && (
            <div className="relative flex flex-wrap gap-1.5 items-center">
              {openDropdown && openDropdown !== "columns" && (
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setOpenDropdown(null)}
                />
              )}
              {filterFields.map((field) => {
                const activeFilter = colFilters.find((f) => f.id === field.id);
                const activeValues = (activeFilter?.value as any[]) || [];
                const isOpen = openDropdown === field.id;

                return (
                  <div key={field.id} className="relative z-20">
                    <button
                      type="button"
                      onClick={() => setOpenDropdown(isOpen ? null : field.id)}
                      className={cn(
                        "h-9 px-3 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-all select-none hover:bg-muted/80 cursor-pointer",
                        activeValues.length > 0
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-input bg-background text-muted-foreground"
                      )}
                    >
                      {field.label}
                      {activeValues.length > 0 && (
                        <span className="ml-1 bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 text-[10px] font-bold">
                          {activeValues.length}
                        </span>
                      )}
                      <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                    </button>

                    {isOpen && (
                      <div className="absolute left-0 mt-1.5 w-48 rounded-xl border border-border bg-card p-2 shadow-xl animate-in fade-in-0 zoom-in-95 duration-100 flex flex-col gap-1 z-30">
                        <div className="max-h-48 overflow-y-auto p-1 flex flex-col gap-1">
                          {field.options.map((opt) => {
                            const isChecked = activeValues.includes(opt.value);
                            return (
                              <label
                                key={String(opt.value)}
                                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted text-xs cursor-pointer select-none font-medium text-foreground"
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    const nextValues = isChecked
                                      ? activeValues.filter((v) => v !== opt.value)
                                      : [...activeValues, opt.value];
                                    
                                    setColFilters(
                                      colFilters.filter((f) => f.id !== field.id).concat(
                                        nextValues.length === 0 ? [] : [{ id: field.id, value: nextValues }]
                                      )
                                    );
                                  }}
                                  className="h-3.5 w-3.5 rounded border-input text-primary focus:ring-primary accent-primary"
                                />
                                {opt.label}
                              </label>
                            );
                          })}
                        </div>
                        {activeValues.length > 0 && (
                          <div className="border-t border-border pt-1.5 mt-1 flex justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                setColFilters(colFilters.filter((f) => f.id !== field.id));
                              }}
                              className="text-[10px] text-muted-foreground hover:text-foreground font-semibold px-2 py-1 transition-colors cursor-pointer"
                            >
                              Clear Filter
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              
              {colFilters.length > 0 && (
                <button
                  type="button"
                  onClick={() => setColFilters([])}
                  className="text-xs font-semibold text-muted-foreground hover:text-foreground px-2 h-9 flex items-center transition-colors cursor-pointer"
                >
                  Clear all
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right actions group */}
        <div className="flex items-center gap-2 w-full md:w-auto mt-2 md:mt-0 justify-end flex-wrap">
          {filterBar}

          {/* Column Visibility Selector */}
          <div className="relative z-20">
            <button
              type="button"
              onClick={() => setOpenDropdown(openDropdown === "columns" ? null : "columns")}
              className="h-9 px-3 rounded-lg border border-input bg-background text-xs font-medium flex items-center gap-1.5 hover:bg-muted/80 cursor-pointer select-none text-muted-foreground"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Columns
            </button>
            {openDropdown === "columns" && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setOpenDropdown(null)} />
                <div className="absolute right-0 mt-1.5 w-44 rounded-xl border border-border bg-card p-2 shadow-xl animate-in fade-in-0 zoom-in-95 duration-100 flex flex-col gap-1 z-30">
                  <div className="max-h-48 overflow-y-auto p-1 flex flex-col gap-1.5">
                    {table.getAllLeafColumns().filter(col => col.id !== "actions" && col.id !== "avatar").map(col => (
                      <label key={col.id} className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-muted text-xs cursor-pointer select-none font-medium text-foreground">
                        <input
                          type="checkbox"
                          checked={col.getIsVisible()}
                          onChange={col.getToggleVisibilityHandler()}
                          className="h-3.5 w-3.5 rounded border-input text-primary focus:ring-primary accent-primary cursor-pointer"
                        />
                        {typeof col.columnDef.header === "string" ? col.columnDef.header : col.id}
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Refresh (sync) Button */}
          <button
            type="button"
            onClick={() => {
              setIsSyncing(true);
              if (onRefresh) onRefresh();
              setTimeout(() => setIsSyncing(false), 800);
            }}
            className="h-9 w-9 rounded-lg border border-input bg-background flex items-center justify-center hover:bg-muted/80 text-muted-foreground cursor-pointer transition-all"
            title="Refresh data"
          >
            <RotateCw className={cn("h-3.5 w-3.5", isSyncing && "animate-spin text-primary")} />
          </button>

          {/* Print Button */}
          <button
            type="button"
            onClick={() => window.print()}
            className="h-9 px-3 rounded-lg border border-input bg-background text-xs font-medium flex items-center gap-1.5 hover:bg-muted/80 text-muted-foreground cursor-pointer"
            title="Print table"
          >
            <Printer className="h-3.5 w-3.5" />
            Print
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="border-b border-border bg-muted/40">
                  {hg.headers.map((header) => {
                    const canSort = header.column.getCanSort();
                    const sorted = header.column.getIsSorted();
                    return (
                      <th
                        key={header.id}
                        className={cn(
                          "px-4 py-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wide whitespace-nowrap",
                          canSort && "cursor-pointer select-none hover:text-foreground transition-colors"
                        )}
                        onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                      >
                        <div className="flex items-center gap-1.5">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {canSort && (
                            <span className="text-muted-foreground/50">
                              {sorted === "asc" ? (
                                <ChevronUp className="h-3.5 w-3.5" />
                              ) : sorted === "desc" ? (
                                <ChevronDown className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronsUpDown className="h-3.5 w-3.5" />
                              )}
                            </span>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length}>
                    <EmptyState title={emptyTitle} description={emptyDescription} />
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-b border-border last:border-0 table-row-hover",
                      onRowClick && "cursor-pointer"
                    )}
                    onClick={() => onRowClick?.(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3 whitespace-nowrap">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {!isLoading && data.length > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground flex-wrap gap-2">
          <div className="flex items-center gap-4 flex-wrap">
            <span>
              Showing{" "}
              {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}–
              {Math.min(
                (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                table.getFilteredRowModel().rows.length
              )}{" "}
              of {table.getFilteredRowModel().rows.length}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium">Rows per page:</span>
              <select
                value={table.getState().pagination.pageSize}
                onChange={(e) => table.setPageSize(Number(e.target.value))}
                className="h-8 rounded-lg border border-border bg-card text-xs px-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer text-foreground"
              >
                {[5, 10, 15, 20, 50, 100].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: Math.max(Math.min(table.getPageCount(), 5), 1) }, (_, i) => {
              const page = i;
              const current = table.getState().pagination.pageIndex;
              return (
                <button
                  key={page}
                  onClick={() => table.setPageIndex(page)}
                  className={cn(
                    "w-8 h-8 flex items-center justify-center rounded-lg text-xs font-medium transition-colors",
                    page === current
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  )}
                >
                  {page + 1}
                </button>
              );
            })}
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
