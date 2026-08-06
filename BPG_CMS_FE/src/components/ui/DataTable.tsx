import React from 'react';
import { LoadingSpinner } from './LoadingSpinner';
import { Pagination } from './Pagination';
import { useVirtualRows } from '../../hooks/useVirtualRows';

export interface ColumnDef<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

export interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  isLoading?: boolean;
  keyExtractor: (item: T) => string | number;
  emptyMessage?: string;
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  onRowClick?: (item: T) => void;
  className?: string;
  enableVirtualization?: boolean;
  virtualizeThreshold?: number;
  virtualRowHeight?: number;
  virtualTableHeight?: number;
}

export function DataTable<T>({
  columns,
  data,
  isLoading,
  keyExtractor,
  emptyMessage = 'Không có dữ liệu',
  currentPage,
  totalPages,
  onPageChange,
  onRowClick,
  className = '',
  enableVirtualization = true,
  virtualizeThreshold = 50,
  virtualRowHeight = 56,
  virtualTableHeight = 520,
}: DataTableProps<T>) {
  const virtual = useVirtualRows(data, {
    rowHeight: virtualRowHeight,
    containerHeight: virtualTableHeight,
    threshold: enableVirtualization ? virtualizeThreshold : Number.MAX_SAFE_INTEGER,
  });

  return (
    <div className={`overflow-hidden border border-slate-200 rounded-xl bg-white ${className}`}>
      <div className="overflow-x-auto" {...virtual.scrollContainerProps}>
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-xs">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={`px-4 py-3 text-slate-500 font-semibold uppercase whitespace-nowrap ${
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                  }`}
                  style={{ width: col.width }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center">
                  <LoadingSpinner />
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-sm text-slate-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              <>
                {virtual.topPadding > 0 && (
                  <tr aria-hidden="true">
                    <td colSpan={columns.length} style={{ height: virtual.topPadding, padding: 0 }} />
                  </tr>
                )}
                {virtual.visibleRows.map(({ item }) => (
                <tr
                  key={keyExtractor(item)}
                  className="hover:bg-slate-50 transition-colors"
                  onClick={onRowClick ? () => onRowClick(item) : undefined}
                  style={onRowClick ? { cursor: 'pointer' } : undefined}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-3.5 text-sm text-slate-700 whitespace-normal break-words ${
                        col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                      }`}
                    >
                      {col.render ? col.render(item) : (item as any)[col.key]}
                    </td>
                  ))}
                </tr>
                ))}
                {virtual.bottomPadding > 0 && (
                  <tr aria-hidden="true">
                    <td colSpan={columns.length} style={{ height: virtual.bottomPadding, padding: 0 }} />
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>
      {totalPages !== undefined && currentPage !== undefined && onPageChange && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
}
