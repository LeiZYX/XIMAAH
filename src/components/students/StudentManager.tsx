"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { ListPagination } from "@/components/ui/ListPagination";
import { PageHeader } from "@/components/ui/PageHeader";
import { LIST_PAGE_SIZES } from "@/lib/pagination";
import { studentStatusLabel } from "@/lib/students/labels";

interface StudentRow {
  id: string;
  name: string;
  email: string | null;
  studentNo: string | null;
  grade: string | null;
  className: string | null;
  status: string;
  isActive: boolean;
  entryYear: number | null;
  graduationYear: number | null;
  graduatedAt: string | null;
  leftAt: string | null;
  archivedAt: string | null;
}

interface StudentManagerProps {
  apiPath: string;
  actionApiPath: string;
  canReactivate?: boolean;
  canManageArchive?: boolean;
}

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "GRADUATED", label: "Graduated" },
  { value: "LEFT", label: "Left" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "ALL", label: "All" },
];

export function StudentManager({
  apiPath,
  actionApiPath,
  canReactivate = true,
  canManageArchive = true,
}: StudentManagerProps) {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(LIST_PAGE_SIZES[0]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [filters, setFilters] = useState({ status: "ACTIVE", q: "", grade: "", className: "" });
  const [graduationYear, setGraduationYear] = useState(String(new Date().getFullYear()));

  const updateFilters = useCallback((patch: Partial<typeof filters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    params.set("status", filters.status);
    if (filters.q) params.set("q", filters.q);
    if (filters.grade) params.set("grade", filters.grade);
    if (filters.className) params.set("className", filters.className);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));

    try {
      const response = await fetch(`${apiPath}?${params.toString()}`);
      const text = await response.text();
      const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
      if (!response.ok) {
        const message =
          typeof data.error === "string" ? data.error : "Failed to load students";
        throw new Error(message);
      }
      setStudents(Array.isArray(data.students) ? (data.students as StudentRow[]) : []);
      setTotal(typeof data.total === "number" ? data.total : 0);
      setTotalPages(typeof data.totalPages === "number" ? data.totalPages : 0);
      if (typeof data.page === "number") setPage(data.page);
    } catch (loadError) {
      setStudents([]);
      setTotal(0);
      setTotalPages(0);
      setError(loadError instanceof Error ? loadError.message : "Failed to load students");
    } finally {
      setLoading(false);
    }
  }, [apiPath, filters, page, pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runAction(studentId: string, action: string) {
    setError(null);
    setMessage(null);
    const body: { action: string; graduationYear?: number } = { action };
    if (action === "graduate") {
      body.graduationYear = Number(graduationYear) || new Date().getFullYear();
    }

    const response = await fetch(`${actionApiPath}/${studentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Action failed");
      return;
    }
    setMessage(`Student ${action} completed.`);
    void load();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Students"
        description="Manage student accounts. Graduated and withdrawn students are archived, not deleted. Historical registrations and fee statements are preserved."
      />

      <Card className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <select
            value={filters.status}
            onChange={(e) => updateFilters({ status: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            placeholder="Search name or student no."
            value={filters.q}
            onChange={(e) => updateFilters({ q: e.target.value })}
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

        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
          {canManageArchive ? (
            <label>
              Graduation year
              <input
                type="number"
                value={graduationYear}
                onChange={(e) => setGraduationYear(e.target.value)}
                className="ml-2 w-24 rounded-lg border border-slate-300 px-2 py-1"
              />
            </label>
          ) : null}
        </div>

        {message ? <p className="text-sm text-green-700">{message}</p> : null}
        {error ? <p className="text-sm text-red-700">{error}</p> : null}

        {loading && students.length === 0 ? (
          <p className="text-sm text-slate-500">Loading...</p>
        ) : students.length === 0 ? (
          <p className="text-sm text-slate-500">No students match the current filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-slate-500">
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Student No.</th>
                  <th className="py-2 pr-3">Grade</th>
                  <th className="py-2 pr-3">Class</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Archived</th>
                  {canManageArchive ? <th className="py-2 pr-3">Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id} className="border-b border-slate-100">
                    <td className="py-2 pr-3">{student.name}</td>
                    <td className="py-2 pr-3">{student.studentNo ?? "—"}</td>
                    <td className="py-2 pr-3">{student.grade ?? "—"}</td>
                    <td className="py-2 pr-3">{student.className ?? "—"}</td>
                    <td className="py-2 pr-3">{studentStatusLabel(student.status as never)}</td>
                    <td className="py-2 pr-3">
                      {student.archivedAt
                        ? new Date(student.archivedAt).toLocaleDateString()
                        : "—"}
                    </td>
                    {canManageArchive ? (
                      <td className="py-2 pr-3">
                        <div className="flex flex-wrap gap-2">
                          {student.status === "ACTIVE" ? (
                            <>
                              <button
                                type="button"
                                onClick={() => void runAction(student.id, "graduate")}
                                className="text-indigo-600 hover:underline"
                              >
                                Graduate
                              </button>
                              <button
                                type="button"
                                onClick={() => void runAction(student.id, "leave")}
                                className="text-amber-700 hover:underline"
                              >
                                Mark left
                              </button>
                              <button
                                type="button"
                                onClick={() => void runAction(student.id, "inactive")}
                                className="text-slate-600 hover:underline"
                              >
                                Inactive
                              </button>
                            </>
                          ) : canReactivate ? (
                            <button
                              type="button"
                              onClick={() => void runAction(student.id, "reactivate")}
                              className="text-emerald-700 hover:underline"
                            >
                              Reactivate
                            </button>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </div>
                      </td>
                    ) : null}
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
          itemLabel="students"
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
