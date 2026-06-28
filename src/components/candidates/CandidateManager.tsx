"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { ListPagination } from "@/components/ui/ListPagination";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  candidateStatusLabel,
  candidateTypeLabel,
} from "@/lib/candidates/labels";
import { LIST_PAGE_SIZES } from "@/lib/pagination";

interface CandidateRow {
  id: string;
  assessmentHubCandidateNumber: string;
  candidateType: string;
  studentNumber: string | null;
  englishName: string;
  chineseName: string | null;
  email: string | null;
  phone: string | null;
  grade: string | null;
  className: string | null;
  status: string;
  loginEnabled: boolean;
}

interface CandidateManagerProps {
  apiPath: string;
  detailBasePath: string;
  defaultCandidateType?: "INTERNAL" | "EXTERNAL";
  showImportLink?: boolean;
  importPath?: string;
}

export function CandidateManager({
  apiPath,
  detailBasePath,
  defaultCandidateType,
  showImportLink = false,
  importPath,
}: CandidateManagerProps) {
  const [rows, setRows] = useState<CandidateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(LIST_PAGE_SIZES[0]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [filters, setFilters] = useState({
    candidateType: defaultCandidateType ?? "",
    status: "",
    q: "",
    grade: "",
    className: "",
    assessmentHubCandidateNumber: "",
    studentNumber: "",
  });

  const updateFilters = useCallback(
    (patch: Partial<typeof filters>) => {
      setFilters((prev) => ({ ...prev, ...patch }));
      setPage(1);
    },
    [],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));

    try {
      const response = await fetch(`${apiPath}?${params.toString()}`);
      const text = await response.text();
      const data = text ? JSON.parse(text) : {};
      if (!response.ok) {
        throw new Error(data?.error ?? "Failed to load candidates");
      }
      setRows(Array.isArray(data.candidates) ? data.candidates : []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 0);
      if (typeof data.page === "number") setPage(data.page);
    } catch (loadError) {
      setRows([]);
      setTotal(0);
      setTotalPages(0);
      setError(loadError instanceof Error ? loadError.message : "Failed to load candidates");
    } finally {
      setLoading(false);
    }
  }, [apiPath, filters, page, pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Candidates"
        description="Manage internal school students and external exam candidates. All registrations reference candidates."
      />

      {showImportLink && importPath ? (
        <p className="text-sm">
          <Link href={importPath} className="text-indigo-600 hover:underline">
            Import internal candidates from Excel/CSV
          </Link>
        </p>
      ) : null}

      <Card className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {!defaultCandidateType ? (
            <select
              value={filters.candidateType}
              onChange={(e) => updateFilters({ candidateType: e.target.value })}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">All types</option>
              <option value="INTERNAL">Internal</option>
              <option value="EXTERNAL">External</option>
            </select>
          ) : null}
          <select
            value={filters.status}
            onChange={(e) => updateFilters({ status: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="GRADUATED">Graduated</option>
            <option value="LEFT">Left</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          <input
            placeholder="Search name or AH number"
            value={filters.q}
            onChange={(e) => updateFilters({ q: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            placeholder="AH candidate number"
            value={filters.assessmentHubCandidateNumber}
            onChange={(e) =>
              updateFilters({ assessmentHubCandidateNumber: e.target.value })
            }
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            placeholder="Student number"
            value={filters.studentNumber}
            onChange={(e) => updateFilters({ studentNumber: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            placeholder="Grade"
            value={filters.grade}
            onChange={(e) => updateFilters({ grade: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            placeholder="Class"
            value={filters.className}
            onChange={(e) => updateFilters({ className: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => {
              setPage(1);
              void load();
            }}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
          >
            Search
          </button>
        </div>

        {error ? <p className="text-sm text-red-700">{error}</p> : null}

        {loading && rows.length === 0 ? (
          <p className="text-sm text-slate-500">Loading...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-500">No candidates match the current filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-slate-500">
                  <th className="py-2 pr-3">AH No.</th>
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Student No.</th>
                  <th className="py-2 pr-3">Grade</th>
                  <th className="py-2 pr-3">Class</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Login</th>
                  <th className="py-2 pr-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="py-2 pr-3 font-mono text-xs">{row.assessmentHubCandidateNumber}</td>
                    <td className="py-2 pr-3">
                      {row.englishName}
                      {row.chineseName ? ` (${row.chineseName})` : ""}
                    </td>
                    <td className="py-2 pr-3">{candidateTypeLabel(row.candidateType as never)}</td>
                    <td className="py-2 pr-3">{row.studentNumber ?? "—"}</td>
                    <td className="py-2 pr-3">{row.grade ?? "—"}</td>
                    <td className="py-2 pr-3">{row.className ?? "—"}</td>
                    <td className="py-2 pr-3">{candidateStatusLabel(row.status as never)}</td>
                    <td className="py-2 pr-3">{row.loginEnabled ? "Yes" : "No"}</td>
                    <td className="py-2 pr-3">
                      <Link href={`${detailBasePath}/${row.id}`} className="text-indigo-600 hover:underline">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <ListPagination
          page={page}
          pageSize={pageSize}
          total={total}
          totalPages={totalPages}
          loading={loading}
          itemLabel="candidates"
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </Card>
    </div>
  );
}
