'use client';

import { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, RefreshCw, AlertCircle } from 'lucide-react';
import ExportButtons from './ExportButtons';
import { fuzzyMatch } from '@/lib/utils';

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  render?: (row: T) => React.ReactNode;
}

export interface FilterOption {
  label: string;
  value: string;
}

export interface TableFilter {
  key: string;
  label: string;
  options: FilterOption[];
  defaultValue?: string;
  match?: (item: any, value: string) => boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  searchPlaceholder?: string;
  searchKeys?: string[];
  filters?: TableFilter[];
  exportFilename?: string;
  exportHeaders?: Record<string, string>;
  loading?: boolean;
  actions?: React.ReactNode;
}

export default function DataTable<T extends Record<string, any>>({
  columns,
  data,
  searchPlaceholder = 'Tìm kiếm...',
  searchKeys = [],
  filters = [],
  exportFilename = 'export_data',
  exportHeaders,
  loading = false,
  actions,
}: DataTableProps<T>) {
  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Filter states
  const [filterValues, setFilterValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    filters.forEach((f) => {
      initial[f.key] = f.defaultValue || 'ALL';
    });
    return initial;
  });

  // Sort state
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Pagination state
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Handle filter changes
  const handleFilterChange = (key: string, value: string) => {
    setFilterValues((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1); // Reset to first page
  };

  // Handle sort changes
  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
    setCurrentPage(1);
  };

  // Filtered and sorted data
  const processedData = useMemo(() => {
    let result = [...data];

    // 1. Filter by dropdowns
    filters.forEach((filter) => {
      const selectedValue = filterValues[filter.key];
      if (selectedValue && selectedValue !== 'ALL') {
        if (filter.match) {
          result = result.filter((item) => filter.match!(item, selectedValue));
        } else {
          result = result.filter((item) => {
            const itemVal = item[filter.key];
            return String(itemVal) === selectedValue;
          });
        }
      }
    });

    // 2. Filter by search query
    if (searchQuery.trim() && searchKeys.length > 0) {
      result = result.filter((item) => {
        return searchKeys.some((key) => {
          // Supports nested keys like user.name
          const parts = key.split('.');
          let val: any = item;
          for (const part of parts) {
            if (val === null || val === undefined) break;
            val = val[part];
          }
          if (val === null || val === undefined) return false;
          return fuzzyMatch(String(val), searchQuery);
        });
      });
    }

    // 3. Sort data
    if (sortKey) {
      result.sort((a, b) => {
        // Supports nested keys for sorting as well
        const getNestedVal = (obj: any, keyString: string) => {
          const parts = keyString.split('.');
          let val = obj;
          for (const part of parts) {
            if (val === null || val === undefined) return '';
            val = val[part];
          }
          return val === null || val === undefined ? '' : val;
        };

        const valA = getNestedVal(a, sortKey);
        const valB = getNestedVal(b, sortKey);

        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortDirection === 'asc' ? valA - valB : valB - valA;
        }

        const strA = String(valA).toLowerCase();
        const strB = String(valB).toLowerCase();

        if (strA < strB) return sortDirection === 'asc' ? -1 : 1;
        if (strA > strB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [data, filters, filterValues, searchQuery, searchKeys, sortKey, sortDirection]);

  // Paginated data
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return processedData.slice(startIndex, startIndex + pageSize);
  }, [processedData, currentPage, pageSize]);

  // Total pages
  const totalPages = Math.ceil(processedData.length / pageSize) || 1;

  // Headers mapping for CSV export
  const csvHeaders = useMemo(() => {
    if (exportHeaders) return exportHeaders;
    const headersMap: Record<string, string> = {};
    columns.forEach((c) => {
      if (c.key !== 'actions') {
        headersMap[c.key] = c.label;
      }
    });
    return headersMap;
  }, [columns, exportHeaders]);

  // Prepare simple flat data for CSV
  const csvData = useMemo(() => {
    return processedData.map((item) => {
      const flatItem: Record<string, any> = {};
      columns.forEach((c) => {
        if (c.key !== 'actions') {
          const parts = c.key.split('.');
          let val: any = item;
          for (const part of parts) {
            if (val === null || val === undefined) break;
            val = val[part];
          }
          flatItem[c.key] = val;
        }
      });
      return flatItem;
    });
  }, [processedData, columns]);

  return (
    <div className="space-y-4">
      {/* Search and Filters panel */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between p-4 rounded-2xl bg-[#1a1f2e]/30 border border-white/5">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          {searchKeys.length > 0 && (
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder={searchPlaceholder}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:border-indigo-500 focus:outline-none transition-all"
              />
            </div>
          )}

          {/* Render filters */}
          <div className="flex flex-wrap items-center gap-2">
            {filters.map((filter) => (
              <div key={filter.key} className="flex items-center gap-1 bg-[#151926] px-2.5 py-1.5 rounded-xl border border-white/5">
                <span className="text-xs text-slate-500 font-medium">{filter.label}:</span>
                <select
                  value={filterValues[filter.key]}
                  onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                  className="bg-transparent text-xs text-slate-200 border-none outline-none focus:ring-0 cursor-pointer pr-1"
                >
                  <option value="ALL" className="bg-[#1a1f2e] text-white">Tất cả</option>
                  {filter.options.map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-[#1a1f2e] text-white">
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* Action buttons (Export + Custom Actions) */}
        <div className="flex items-center justify-end gap-2.5">
          <ExportButtons data={csvData} filename={exportFilename} headers={csvHeaders} />
          {actions}
        </div>
      </div>

      {/* Main Table */}
      <div className="rounded-2xl bg-[#1a1f2e]/50 border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/2">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => col.sortable && handleSort(col.key)}
                    className={`px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider ${
                      col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'
                    } ${col.sortable ? 'cursor-pointer select-none hover:text-white transition-colors' : ''}`}
                  >
                    <div className={`flex items-center gap-1.5 ${
                      col.align === 'center' ? 'justify-center' : col.align === 'right' ? 'justify-end' : ''
                    }`}>
                      {col.label}
                      {col.sortable && sortKey === col.key && (
                        sortDirection === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                // Skeleton Loader rows
                Array.from({ length: 5 }).map((_, rIdx) => (
                  <tr key={rIdx} className="border-b border-white/3">
                    {columns.map((col, cIdx) => (
                      <td key={cIdx} className="px-5 py-4">
                        <div className="h-4 bg-white/5 rounded animate-pulse w-full max-w-[120px]"></div>
                      </td>
                    ))}
                  </tr>
                ))
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-5 py-12 text-center text-slate-500">
                    <AlertCircle className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                    <p className="text-sm font-medium">Không tìm thấy dữ liệu phù hợp</p>
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, rIdx) => (
                  <tr key={row.id || rIdx} className="border-b border-white/3 table-row-hover transition-colors">
                    {columns.map((col) => {
                      const value = col.render ? col.render(row) : (row[col.key] !== null && row[col.key] !== undefined ? String(row[col.key]) : '—');
                      return (
                        <td
                          key={col.key}
                          className={`px-5 py-3.5 ${
                            col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'
                          }`}
                        >
                          {value}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Panel */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-5 py-4 border-t border-white/5 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span>Hiển thị</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white/5 border border-white/10 px-2 py-1 rounded-lg text-slate-300 outline-none"
            >
              {[10, 20, 50, 100].map((size) => (
                <option key={size} value={size} className="bg-[#1a1f2e] text-white">
                  {size} dòng
                </option>
              ))}
            </select>
            <span>trong tổng số {processedData.length} kết quả</span>
          </div>

          <div className="flex items-center gap-1.5 justify-end">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1 || loading}
              className="p-1.5 rounded-lg border border-white/5 hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            
            {Array.from({ length: totalPages }).map((_, idx) => {
              const pageNum = idx + 1;
              const isSelected = pageNum === currentPage;
              // Simple paging logic: show first, last, and window around current page
              if (
                pageNum === 1 ||
                pageNum === totalPages ||
                Math.abs(pageNum - currentPage) <= 1
              ) {
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-7 h-7 rounded-lg text-xs font-semibold border transition-all ${
                      isSelected
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                        : 'border-white/5 hover:bg-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              }
              if (pageNum === 2 || pageNum === totalPages - 1) {
                return (
                  <span key={pageNum} className="px-1 text-slate-600">
                    ...
                  </span>
                );
              }
              return null;
            })}

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || loading}
              className="p-1.5 rounded-lg border border-white/5 hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
