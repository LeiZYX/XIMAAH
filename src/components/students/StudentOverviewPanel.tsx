"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CandidatesSubnav } from "@/components/candidates/CandidatesSubnav";
import { Card } from "@/components/ui/Card";
import { ListPagination } from "@/components/ui/ListPagination";
import { PageHeader } from "@/components/ui/PageHeader";
import { LIST_PAGE_SIZES } from "@/lib/pagination";
import type {
  StudentOverviewGradeBucket,
  StudentOverviewRow,
  StudentOverviewSummary,
} from "@/lib/students/overview";

type GradeSelection = "ALL" | StudentOverviewGradeBucket["grade"];
type CandidateTypeSelection = "INTERNAL" | "EXTERNAL";

interface StudentOverviewPanelProps {
  apiPath: string;
  detailBasePath: string;
  moduleBasePath: string;
}

export function StudentOverviewPanel({
  apiPath,
  detailBasePath,
  moduleBasePath,
}: StudentOverviewPanelProps) {
  const [summary, setSummary] = useState<StudentOverviewSummary | null>(null);
  const [students, setStudents] = useState<StudentOverviewRow[]>([]);
  const [candidateType, setCandidateType] = useState<CandidateTypeSelection>("INTERNAL");
  const [selectedGrade, setSelectedGrade] = useState<GradeSelection>("ALL");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(LIST_PAGE_SIZES[0] ?? 50);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        candidateType,
        status,
        page: String(page),
        pageSize: String(pageSize),
      });
      if (selectedGrade !== "ALL") params.set("grade", selectedGrade);
      if (q.trim()) params.set("q", q.trim());

      const res = await fetch(`${apiPath}?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Failed to load overview");
      }

      setSummary(data.summary ?? null);
      setStudents(Array.isArray(data.students) ? data.students : []);
      setTotal(typeof data.total === "number" ? data.total : 0);
      setTotalPages(typeof data.totalPages === "number" ? data.totalPages : 0);
    } catch (err) {
      setSummary(null);
      setStudents([]);
      setTotal(0);
      setTotalPages(0);
      setError(err instanceof Error ? err.message : "Failed to load overview");
    } finally {
      setLoading(false);
    }
  }, [apiPath, candidateType, page, pageSize, q, selectedGrade, status]);

  useEffect(() => {
    void load();
  }, [load]);

  function selectCandidateType(next: CandidateTypeSelection) {
    setCandidateType(next);
    setSelectedGrade("ALL");
    setPage(1);
  }

  function selectGrade(grade: GradeSelection) {
    setSelectedGrade(grade);
    setPage(1);
  }

  const typeLabel = candidateType === "INTERNAL" ? "Internal" : "External";
  const listTitle =
    selectedGrade === "ALL"
      ? `All ${typeLabel.toLowerCase()} candidates`
      : selectedGrade === "UNASSIGNED"
        ? `${typeLabel} · Unassigned grade`
        : `${typeLabel} · ${summary?.byGrade.find((row) => row.grade === selectedGrade)?.label ?? selectedGrade}`;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Student Overview"
        description="Census by candidate type and grade. Switch Internal / External, then select a grade to list school numbers, names, date of birth, gender, and UCI."
      />
      <CandidatesSubnav basePath={moduleBasePath} />

      <div className="flex flex-wrap gap-2">
        {(
          [
            { value: "INTERNAL", label: "Internal" },
            { value: "EXTERNAL", label: "External" },
          ] as const
        ).map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => selectCandidateType(option.value)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              candidateType === option.value
                ? "bg-slate-900 text-white"
                : "border border-slate-200 bg-white text-slate-700 hover:border-slate-400"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Status
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal"
            >
              <option value="ACTIVE">Active</option>
              <option value="ALL">All statuses</option>
              <option value="GRADUATED">Graduated</option>
              <option value="LEFT">Left</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </label>
          <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-sm font-medium text-slate-700">
            Search
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setPage(1);
                  void load();
                }
              }}
              placeholder="Name, school number, UCI…"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              setPage(1);
              void load();
            }}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Apply
          </button>
        </div>
      </Card>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <button
          type="button"
          onClick={() => selectGrade("ALL")}
          className={`rounded-lg border px-4 py-3 text-left transition ${
            selectedGrade === "ALL"
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-slate-200 bg-white text-slate-900 hover:border-slate-400"
          }`}
        >
          <p className="text-xs font-medium uppercase tracking-wide opacity-80">Total</p>
          <p className="mt-1 text-2xl font-semibold">{summary?.total ?? "—"}</p>
          <p className="mt-1 text-xs opacity-80">{typeLabel} candidates</p>
        </button>
        {(summary?.byGrade ?? []).map((bucket) => (
          <button
            key={bucket.grade}
            type="button"
            onClick={() => selectGrade(bucket.grade)}
            className={`rounded-lg border px-4 py-3 text-left transition ${
              selectedGrade === bucket.grade
                ? "border-indigo-700 bg-indigo-700 text-white"
                : "border-slate-200 bg-white text-slate-900 hover:border-indigo-300"
            }`}
          >
            <p className="text-xs font-medium uppercase tracking-wide opacity-80">{bucket.label}</p>
            <p className="mt-1 text-2xl font-semibold">{bucket.count}</p>
            <p className="mt-1 text-xs opacity-80">students</p>
          </button>
        ))}
      </div>

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900">{listTitle}</h2>
          <p className="text-sm text-slate-500">
            {loading ? "Loading…" : `${total} student${total === 1 ? "" : "s"}`}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">School No.</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Chinese name</th>
                <th className="px-3 py-2">DOB</th>
                <th className="px-3 py-2">Gender</th>
                <th className="px-3 py-2">Grade</th>
                <th className="px-3 py-2">Class</th>
                <th className="px-3 py-2">UCI</th>
                <th className="px-3 py-2">School</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {!loading && students.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-slate-500">
                    No students in this selection.
                  </td>
                </tr>
              ) : (
                students.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-2 font-medium text-slate-900">
                      {row.studentNumber ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-slate-900">{row.englishName}</td>
                    <td className="px-3 py-2 text-slate-700">{row.chineseName ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-700">{row.dateOfBirth ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-700">{row.genderLabel ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-700">{row.gradeLabel ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-700">{row.className ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-slate-700">
                      {row.uciByBoard.length > 0 ? (
                        <ul className="space-y-0.5">
                          {row.uciByBoard.map((uci) => (
                            <li key={`${row.id}-${uci.boardCode}`}>
                              <span className="font-medium">{uci.uciNumber}</span>
                              <span className="text-slate-500"> ({uci.boardCode})</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-700">{row.schoolName ?? "—"}</td>
                    <td className="px-3 py-2">
                      <Link
                        href={`${detailBasePath}/${row.id}`}
                        className="text-indigo-700 hover:underline"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4">
          <ListPagination
            page={page}
            pageSize={pageSize}
            total={total}
            totalPages={totalPages}
            loading={loading}
            itemLabel="students"
            onPageChange={setPage}
            onPageSizeChange={(next) => {
              setPageSize(next);
              setPage(1);
            }}
          />
        </div>
      </Card>
    </div>
  );
}
