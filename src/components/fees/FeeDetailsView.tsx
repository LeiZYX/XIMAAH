"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { FeeDetailsCandidateGroups } from "@/components/fees/FeeDetailsCandidateGroups";
import { FeeManagementNav } from "@/components/fees/FeeManagementNav";
import {
  FeeReportFiltersForm,
  filtersToParams,
} from "@/components/fees/FeeReportFiltersForm";
import type { FeeReportFilters } from "@/lib/fees/filters";
import { FEE_DETAILS_PAGE_SIZES } from "@/lib/fees/filters";
import type { CandidateFeeDetailGroup } from "@/lib/fees/reporting";

interface FeeDetailsViewProps {
  basePath: "/admin" | "/exam-office";
  initialFilters?: FeeReportFilters;
}

export function FeeDetailsView({ basePath, initialFilters }: FeeDetailsViewProps) {
  const searchParams = useSearchParams();
  const [draftFilters, setDraftFilters] = useState<FeeReportFilters>(initialFilters ?? {});
  const [appliedFilters, setAppliedFilters] = useState<FeeReportFilters | null>(null);
  const [groups, setGroups] = useState<CandidateFeeDetailGroup[]>([]);
  const [showCosts, setShowCosts] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(FEE_DETAILS_PAGE_SIZES[0]);
  const [totalCandidates, setTotalCandidates] = useState(0);
  const [totalLines, setTotalLines] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const windowId = searchParams.get("registrationWindowId");
    if (!windowId) return;
    const fromUrl: FeeReportFilters = { registrationWindowId: windowId };
    setDraftFilters((prev) =>
      prev.registrationWindowId === windowId ? prev : { ...prev, ...fromUrl },
    );
    setAppliedFilters(fromUrl);
    setPage(1);
  }, [searchParams]);

  const load = useCallback(async () => {
    if (!appliedFilters?.registrationWindowId) {
      setGroups([]);
      setTotalCandidates(0);
      setTotalLines(0);
      setTotalPages(0);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams(filtersToParams(appliedFilters));
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));

      const response = await fetch(`/api/fees/details?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to load details");

      setGroups(data.groups ?? []);
      setShowCosts(Boolean(data.showCosts));
      setTotalCandidates(data.totalCandidates ?? 0);
      setTotalLines(data.totalLines ?? 0);
      setTotalPages(data.totalPages ?? 0);
      if (typeof data.page === "number") setPage(data.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load details");
      setGroups([]);
      setTotalCandidates(0);
      setTotalLines(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, page, pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  function handleSearch() {
    if (!draftFilters.registrationWindowId) return;
    setAppliedFilters({ ...draftFilters });
    setPage(1);
  }

  function exportFile(format: "csv" | "xlsx") {
    if (!appliedFilters?.registrationWindowId) return;
    window.location.href = `/api/fees/export?type=details&format=${format}&${filtersToParams(appliedFilters)}`;
  }

  const canExport = Boolean(appliedFilters?.registrationWindowId);
  const showingFrom =
    totalCandidates === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(page * pageSize, totalCandidates);

  return (
    <div className="space-y-6">
      <FeeManagementNav basePath={basePath} />
      <PageHeader
        title="Fee Details"
        description="Line-level fee details grouped by candidate. Select a registration window to load data."
      />
      <Card className="space-y-4">
        <FeeReportFiltersForm
          filters={draftFilters}
          onChange={setDraftFilters}
          onSearch={handleSearch}
          showBatchOptions
          requireRegistrationWindow
        />
      </Card>

      {error ? (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}

      {!appliedFilters?.registrationWindowId ? (
        <Card>
          <p className="text-sm text-slate-600">
            Select a registration window and click Search to load fee details.
          </p>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              {loading
                ? "Loading..."
                : `Showing ${showingFrom}–${showingTo} of ${totalCandidates} candidates (${totalLines} exam entries)`}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                Per page
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                >
                  {FEE_DETAILS_PAGE_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => exportFile("csv")}
                disabled={!canExport}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Export CSV
              </button>
              <button
                type="button"
                onClick={() => exportFile("xlsx")}
                disabled={!canExport}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Export Excel
              </button>
            </div>
          </div>

          {loading ? (
            <Card>
              <p className="p-4 text-sm text-slate-600">Loading fee details...</p>
            </Card>
          ) : (
            <FeeDetailsCandidateGroups groups={groups} showCosts={showCosts} />
          )}

          {totalPages > 1 ? (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-slate-600">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
