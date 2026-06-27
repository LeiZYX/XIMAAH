"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";

interface RegistrationRow {
  id: string;
  status: string;
  submittedAt: string;
  studentNameSnapshot: string;
  studentNoSnapshot: string;
  gradeSnapshot: string;
  classNameSnapshot: string;
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

export function RegistrationList({
  apiPath,
  exportPath,
  showStudentColumns = true,
}: RegistrationListProps) {
  const [rows, setRows] = useState<RegistrationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    examBoardId: "",
    grade: "",
    className: "",
    studentName: "",
    studentNo: "",
    status: "",
    year: "",
    month: "",
  });

  async function load() {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    try {
      const response = await fetch(`${apiPath}?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not load registrations");
      }
      setRows(Array.isArray(data) ? data : []);
    } catch (loadError) {
      setRows([]);
      setError(loadError instanceof Error ? loadError.message : "Could not load registrations");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input
            placeholder="Student name"
            value={filters.studentName}
            onChange={(e) => setFilters({ ...filters, studentName: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            placeholder="Student number"
            value={filters.studentNo}
            onChange={(e) => setFilters({ ...filters, studentNo: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            placeholder="Grade"
            value={filters.grade}
            onChange={(e) => setFilters({ ...filters, grade: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            placeholder="Class"
            value={filters.className}
            onChange={(e) => setFilters({ ...filters, className: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            placeholder="Year"
            value={filters.year}
            onChange={(e) => setFilters({ ...filters, year: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            placeholder="Month"
            value={filters.month}
            onChange={(e) => setFilters({ ...filters, month: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="LOCKED">Locked</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={load}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
            >
              Filter
            </button>
            {exportPath ? (
              <a
                href={`${exportPath}?${new URLSearchParams(
                  Object.entries(filters).filter(([, v]) => v) as [string, string][],
                ).toString()}&format=csv`}
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

      <Card className="overflow-x-auto">
        {loading ? (
          <p className="text-sm text-slate-500">Loading...</p>
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
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && rows.length === 0 ? (
          <p className="text-sm text-slate-500">No registrations found.</p>
        ) : null}
      </Card>
    </div>
  );
}
