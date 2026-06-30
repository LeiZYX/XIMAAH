"use client";

import { FEE_RULES_PAGE_SIZES, LIST_PAGE_SIZES } from "@/lib/pagination";

interface ListPaginationProps {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  loading?: boolean;
  itemLabel?: string;
  pageSizes?: readonly number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export function ListPagination({
  page,
  pageSize,
  total,
  totalPages,
  loading = false,
  itemLabel = "items",
  pageSizes = LIST_PAGE_SIZES,
  onPageChange,
  onPageSizeChange,
}: ListPaginationProps) {
  const showingFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
      <p className="text-sm text-slate-600">
        {loading
          ? "Loading..."
          : total === 0
            ? `No ${itemLabel}`
            : `Showing ${showingFrom}–${showingTo} of ${total} ${itemLabel}`}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          Per page
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            disabled={loading}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm disabled:opacity-50"
          >
            {pageSizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        {totalPages > 1 ? (
          <>
            <button
              type="button"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1 || loading}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-slate-600">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages || loading}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
