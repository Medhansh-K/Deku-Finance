"use client";

import React, { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Search, ChevronsUpDown, ArrowUp, ArrowDown, Loader2 } from "lucide-react";

export interface ColumnDef<TData> {
  header: React.ReactNode;
  cell: (row: TData) => React.ReactNode;
  sortKey?: (row: TData) => string | number;
  sortable?: boolean;
  align?: "left" | "center" | "right";
  width?: string;
}

export interface DataTableProps<TData> {
  columns: ColumnDef<TData>[];
  data: TData[];
  searchPlaceholder?: string;
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: TData) => void;
  pageSize?: number;
}

export function DataTable<TData>({
  columns,
  data,
  searchPlaceholder = "Search records...",
  isLoading = false,
  emptyMessage = "No accounting records found.",
  onRowClick,
  pageSize = 15,
}: DataTableProps<TData>) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortColumnIndex, setSortColumnIndex] = useState<number | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(0);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  // 1. Filter data based on search query
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;
    const q = searchQuery.toLowerCase();
    return data.filter((item) => {
      const serialized = JSON.stringify(item).toLowerCase();
      return serialized.includes(q);
    });
  }, [data, searchQuery]);

  // 2. Sort data
  const sortedData = useMemo(() => {
    if (sortColumnIndex === null) return filteredData;
    const col = columns[sortColumnIndex];
    if (!col || !col.sortKey) return filteredData;

    return [...filteredData].sort((a, b) => {
      const valA = col.sortKey!(a);
      const valB = col.sortKey!(b);

      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;

      const comp = valA < valB ? -1 : 1;
      return sortDirection === "asc" ? comp : -comp;
    });
  }, [filteredData, sortColumnIndex, sortDirection, columns]);

  // 3. Paginate data
  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const pageData = useMemo(() => {
    const start = currentPage * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const handleSort = (index: number) => {
    const col = columns[index];
    if (!col.sortable && !col.sortKey) return;

    if (sortColumnIndex === index) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else {
        setSortColumnIndex(null);
      }
    } else {
      setSortColumnIndex(index);
      setSortDirection("asc");
    }
    setCurrentPage(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (pageData.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((prev) =>
        prev === null || prev >= pageData.length - 1 ? 0 : prev + 1
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((prev) =>
        prev === null || prev <= 0 ? pageData.length - 1 : prev - 1
      );
    } else if (e.key === "Enter" && focusedIndex !== null) {
      e.preventDefault();
      const selected = pageData[focusedIndex];
      if (selected && onRowClick) {
        onRowClick(selected);
      }
    }
  };

  return (
    <div
      className="space-y-3 font-sans outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Search & Actions Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            suppressHydrationWarning
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(0);
            }}
            placeholder={searchPlaceholder}
            className="w-full rounded border border-[#cbd5e1] bg-white pl-9 pr-4 py-1.5 text-xs text-[#0f172a] placeholder-[#94a3b8] focus:border-[#5BB5BB] focus:outline-none focus:ring-1 focus:ring-[#5BB5BB]"
          />
        </div>
        <div className="text-xs text-slate-500 font-mono">
          Showing {pageData.length} of {data.length} records
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto rounded border border-[#3E4848] bg-white shadow-xs">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr>
              {columns.map((col, idx) => {
                const isSorted = sortColumnIndex === idx;
                const canSort = col.sortable || Boolean(col.sortKey);
                return (
                  <th
                    key={idx}
                    onClick={() => canSort && handleSort(idx)}
                    style={{ width: col.width }}
                    className={`deku-table-th select-none ${
                      canSort ? "cursor-pointer hover:bg-[#2A3132]" : ""
                    } ${
                      col.align === "right"
                        ? "text-right"
                        : col.align === "center"
                        ? "text-center"
                        : "text-left"
                    } transition-colors`}
                  >
                    <div
                      className={`flex items-center gap-1 ${
                        col.align === "right"
                          ? "justify-end"
                          : col.align === "center"
                          ? "justify-center"
                          : "justify-between"
                      }`}
                    >
                      <span>{col.header}</span>
                      {canSort && (
                        <span className="opacity-70">
                          {isSorted ? (
                            sortDirection === "asc" ? (
                              <ArrowUp className="h-3 w-3 text-[#5BB5BB]" />
                            ) : (
                              <ArrowDown className="h-3 w-3 text-[#5BB5BB]" />
                            )
                          ) : (
                            <ChevronsUpDown className="h-3 w-3 text-slate-400" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {isLoading ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-12 text-center text-slate-500"
                >
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin text-[#5BB5BB]" />
                    <span className="font-medium">Loading authoritative data...</span>
                  </div>
                </td>
              </tr>
            ) : pageData.length > 0 ? (
              pageData.map((row, index) => {
                const isFocused = focusedIndex === index;
                return (
                  <tr
                    key={index}
                    onClick={() => {
                      setFocusedIndex(index);
                      if (onRowClick) onRowClick(row);
                    }}
                    className={`cursor-pointer transition-colors ${
                      isFocused
                        ? "bg-[#5BB5BB]/15 text-[#0A0A0A] font-medium"
                        : "hover:bg-slate-50 text-[#1e293b]"
                    }`}
                  >
                    {columns.map((col, cIdx) => (
                      <td
                        key={cIdx}
                        className={`deku-table-td ${
                          col.align === "right"
                            ? "text-right"
                            : col.align === "center"
                            ? "text-center"
                            : "text-left"
                        }`}
                      >
                        {col.cell(row)}
                      </td>
                    ))}
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-8 text-center text-slate-500 font-mono text-xs"
                >
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between text-xs text-slate-600 px-1">
        <div className="flex items-center gap-1 font-mono">
          Page {currentPage + 1} of {totalPages}
        </div>
        <div className="flex items-center gap-2">
          <button
            suppressHydrationWarning
            onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
            disabled={currentPage === 0}
            className="flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Previous
          </button>
          <button
            suppressHydrationWarning
            onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={currentPage >= totalPages - 1}
            className="flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none"
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
