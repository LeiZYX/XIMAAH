"use client";

import {
  billingScopeLabel,
  registrationSourceLabel,
  visibilityLabel,
} from "@/lib/registrations/metadata";
import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { ListPagination } from "@/components/ui/ListPagination";
import { useRegistrationsRefresh } from "@/components/registrations/registrations-refresh";
import { LIST_PAGE_SIZES } from "@/lib/pagination";

interface RegistrationRow {
  id: string;
  status: string;
  submittedAt: string;
  studentNameSnapshot: string;
  studentNoSnapshot: string;
  gradeSnapshot: string;
  classNameSnapshot: string;
  registrationSource?: string;
  visibility?: string;
  billingScope?: string;
  examBoard: { name: string; code: string };
  examSeries: { name: string; year: number };
  subject: { name: string; code: string };
  paper: { code: string; title: string };
  examSession: { date: string; startTime: string | null };
}

interface RegistrationListProps {
  apiPath: string;
  exportPath?: string;
  showStudentColumns?: boolean;
}

const EMPTY_FILTERS = {
  examBoardId: "",
  grade: "",
  className: "",
  studentName: "",
  studentNo: "",
  status: "",
  year: "",
  month: "",
  registrationSource: "",
  visibility: "",
  billingScope: "",
  registrationType: "",
  studentType: "",
  candidateType: "",
  assessmentHubCandidateNumber: "",
};

export function RegistrationList({
  apiPath,
  exportPath,
  showStudentColumns = true,
}: RegistrationListProps) {
  const [rows, setRows] = useState<RegistrationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(LIST_PAGE_SIZES[0]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [draftFilters, setDraftFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);
  const { registrationWindowId, registrationTypes } = useRegistrationsRefresh();

  useEffect(() => {
    setPage(1);
  }, [registrationWindowId, registrationTypes]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    Object.entries(appliedFilters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    if (registrationWindowId) {
      params.set("registrationWindowId", registrationWindowId);
    }
    if (!appliedFilters.registrationType && registrationTypes.length > 0) {
      params.set("registrationTypes", registrationTypes.join(","));
    }
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));

    try {
      const response = await fetch(`${apiPath}?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not load registrations");
      }
      setRows(Array.isArray(data.registrations) ? data.registrations : []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 0);
      if (typeof data.page === "number") setPage(data.page);
    } catch (loadError) {
      setRows([]);
      setTotal(0);
      setTotalPages(0);
      setError(loadError instanceof Error ? loadError.message : "Could not load registrations");
    } finally {
      setLoading(false);
    }
  }, [apiPath, appliedFilters, page, pageSize, registrationWindowId, registrationTypes]);

  useEffect(() => {
    void load();
  }, [load]);

  function handleFilter() {
    setAppliedFilters({ ...draftFilters });
    setPage(1);
  }

  function exportParams() {
    const entries = Object.entries(appliedFilters).filter(([, value]) => value) as [
      string,
      string,
    ][];
    if (registrationWindowId) {
      entries.push(["registrationWindowId", registrationWindowId]);
    }
    return new URLSearchParams(entries).toString();
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Registration details</h2>
          <p className="mt-1 text-sm text-slate-600">
            Filtered by the registration window selected above. Search by student name or number
            includes archived students using registration snapshot fields.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input
            placeholder="Student name"
            value={draftFilters.studentName}
            onChange={(e) => setDraftFilters({ ...draftFilters, studentName: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            placeholder="Student number"
            value={draftFilters.studentNo}
            onChange={(e) => setDraftFilters({ ...draftFilters, studentNo: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            placeholder="Grade"
            value={draftFilters.grade}
            onChange={(e) => setDraftFilters({ ...draftFilters, grade: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            placeholder="Class"
            value={draftFilters.className}
            onChange={(e) => setDraftFilters({ ...draftFilters, className: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            placeholder="Year"
            value={draftFilters.year}
            onChange={(e) => setDraftFilters({ ...draftFilters, year: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            placeholder="Month"
            value={draftFilters.month}
            onChange={(e) => setDraftFilters({ ...draftFilters, month: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={draftFilters.status}
            onChange={(e) => setDraftFilters({ ...draftFilters, status: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="LOCKED">Locked</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <select
            value={draftFilters.registrationSource}
            onChange={(e) =>
              setDraftFilters({ ...draftFilters, registrationSource: e.target.value })
            }
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">All sources</option>
            <option value="STUDENT_SUBMITTED">Student submitted</option>
            <option value="EO_ASSISTED">EO assisted</option>
            <option value="ADMIN_ASSISTED">Admin assisted</option>
            <option value="EO_FORCED_INTERNAL">EO restricted</option>
            <option value="ADMIN_FORCED_INTERNAL">Admin restricted</option>
            <option value="EXTERNAL_CANDIDATE">External candidate</option>
          </select>
          <select
            value={draftFilters.visibility}
            onChange={(e) => setDraftFilters({ ...draftFilters, visibility: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">All visibility</option>
            <option value="STUDENT_AND_TEACHER">Student visible</option>
            <option value="STUDENT_ONLY">Student only</option>
            <option value="EXAM_OFFICE_ONLY">Restricted</option>
          </select>
          <select
            value={draftFilters.registrationType ?? ""}
            onChange={(e) =>
              setDraftFilters({ ...draftFilters, registrationType: e.target.value })
            }
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">All registration types</option>
            <option value="NORMAL">Normal</option>
            <option value="RESTRICTED">Restricted</option>
            <option value="EXTERNAL">External</option>
          </select>
          <select
            value={draftFilters.billingScope}
            onChange={(e) => setDraftFilters({ ...draftFilters, billingScope: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">All billing</option>
            <option value="NORMAL_BILLING">Normal billing</option>
            <option value="MANUAL_REVIEW">Manual review</option>
            <option value="OFFICE_ONLY_BILLING">Restricted billing</option>
            <option value="NO_BILLING">No billing</option>
          </select>
          <select
            value={draftFilters.candidateType}
            onChange={(e) => setDraftFilters({ ...draftFilters, candidateType: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">All candidate types</option>
            <option value="INTERNAL">Internal</option>
            <option value="EXTERNAL">External</option>
          </select>
          <input
            placeholder="AH candidate number"
            value={draftFilters.assessmentHubCandidateNumber}
            onChange={(e) =>
              setDraftFilters({ ...draftFilters, assessmentHubCandidateNumber: e.target.value })
            }
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleFilter}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
            >
              Filter
            </button>
            {exportPath ? (
              <a
                href={`${exportPath}?${exportParams()}&format=csv`}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
              >
                Export CSV
              </a>
            ) : null}
          </div>
        </div>
      </Card>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <Card className="space-y-4 overflow-x-auto">
        {loading && rows.length === 0 ? (
          <p className="text-sm text-slate-500">Loading...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-500">No registrations found.</p>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase text-slate-500">
                {showStudentColumns ? (
                  <>
                    <th className="py-2 pr-4">Student</th>
                    <th className="py-2 pr-4">No.</th>
                    <th className="py-2 pr-4">Grade</th>
                    <th className="py-2 pr-4">Class</th>
                  </>
                ) : null}
                <th className="py-2 pr-4">Board</th>
                <th className="py-2 pr-4">Series</th>
                <th className="py-2 pr-4">Subject</th>
                <th className="py-2 pr-4">Paper</th>
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Status</th>
                {showStudentColumns ? (
                  <>
                    <th className="py-2 pr-4">Source</th>
                    <th className="py-2 pr-4">Visibility</th>
                    <th className="py-2 pr-4">Billing</th>
                  </>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  {showStudentColumns ? (
                    <>
                      <td className="py-2 pr-4">{row.studentNameSnapshot}</td>
                      <td className="py-2 pr-4">{row.studentNoSnapshot}</td>
                      <td className="py-2 pr-4">{row.gradeSnapshot}</td>
                      <td className="py-2 pr-4">{row.classNameSnapshot}</td>
                    </>
                  ) : null}
                  <td className="py-2 pr-4">{row.examBoard.name}</td>
                  <td className="py-2 pr-4">
                    {row.examSeries.name} ({row.examSeries.year})
                  </td>
                  <td className="py-2 pr-4">{row.subject.name}</td>
                  <td className="py-2 pr-4">{row.paper.code}</td>
                  <td className="py-2 pr-4">
                    {row.examSession.date.slice(0, 10)}
                    {row.examSession.startTime ? ` ${row.examSession.startTime}` : ""}
                  </td>
                  <td className="py-2 pr-4">{row.status}</td>
                  {showStudentColumns ? (
                    <>
                      <td className="py-2 pr-4">
                        {row.registrationSource
                          ? registrationSourceLabel(row.registrationSource)
                          : "—"}
                      </td>
                      <td className="py-2 pr-4">
                        {row.visibility ? visibilityLabel(row.visibility) : "—"}
                      </td>
                      <td className="py-2 pr-4">
                        {row.billingScope ? billingScopeLabel(row.billingScope) : "—"}
                      </td>
                    </>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <ListPagination
          page={page}
          pageSize={pageSize}
          total={total}
          totalPages={totalPages}
          loading={loading}
          itemLabel="registrations"
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
