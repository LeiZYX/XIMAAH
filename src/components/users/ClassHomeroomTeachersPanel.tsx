"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";

const GRADES = ["G9", "G10", "G11", "G12"] as const;

interface TeacherOption {
  id: string;
  name: string;
  email: string | null;
  username: string | null;
  teacherProfile?: { email: string | null } | null;
}

interface HomeroomRow {
  id: string;
  grade: string;
  className: string;
  teacherUserId: string;
  teacher: TeacherOption & { isActive?: boolean };
}

function gradeLabel(grade: string): string {
  return grade.replace(/^G/, "Grade ");
}

export function ClassHomeroomTeachersPanel({ apiPath }: { apiPath: string }) {
  const [rows, setRows] = useState<HomeroomRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [grade, setGrade] = useState<string>("G10");
  const [className, setClassName] = useState("");
  const [teacherUserId, setTeacherUserId] = useState("");
  const [filterGrade, setFilterGrade] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${apiPath}?withTeachers=1`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Failed to load form teachers");
      }
      if (Array.isArray(data)) {
        setRows(data);
        setTeachers([]);
      } else {
        setRows(Array.isArray(data.assignments) ? data.assignments : []);
        setTeachers(Array.isArray(data.teachers) ? data.teachers : []);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [apiPath]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleRows = useMemo(() => {
    if (!filterGrade) return rows;
    return rows.filter((row) => row.grade === filterGrade);
  }, [filterGrade, rows]);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(apiPath, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grade, className, teacherUserId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Could not save assignment");
      }
      setClassName("");
      setMessage("Form teacher assignment saved.");
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!globalThis.confirm("Remove this form teacher assignment?")) return;
    setError(null);
    setMessage(null);
    const response = await fetch(`${apiPath}?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.error || "Could not delete");
      return;
    }
    setMessage("Assignment removed.");
    await load();
  }

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-lg font-semibold text-slate-900">Assign form teacher (班主任)</h2>
        <p className="mt-1 text-sm text-slate-600">
          Each grade + class can have one form teacher. Students cannot submit late adjustment
          requests until their class is configured. Same-grade form teachers may also review those
          requests.
        </p>
        <form onSubmit={(e) => void handleSave(e)} className="mt-4 grid gap-3 sm:grid-cols-4">
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Grade</span>
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              required
            >
              {GRADES.map((value) => (
                <option key={value} value={value}>
                  {gradeLabel(value)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Class</span>
            <input
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              placeholder="e.g. 10A"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              required
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block text-slate-600">Form teacher</span>
            <select
              value={teacherUserId}
              onChange={(e) => setTeacherUserId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              required
            >
              <option value="">Select teacher…</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.name}
                  {teacher.email || teacher.teacherProfile?.email
                    ? ` · ${teacher.email || teacher.teacherProfile?.email}`
                    : ""}
                </option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-4">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save assignment"}
            </button>
          </div>
        </form>
      </Card>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </div>
      ) : null}

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">Current assignments</h2>
          <select
            value={filterGrade}
            onChange={(e) => setFilterGrade(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="">All grades</option>
            {GRADES.map((value) => (
              <option key={value} value={value}>
                {gradeLabel(value)}
              </option>
            ))}
          </select>
        </div>
        {loading ? (
          <p className="text-sm text-slate-600">Loading…</p>
        ) : visibleRows.length === 0 ? (
          <p className="text-sm text-slate-600">No form teacher assignments yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600">
                  <th className="py-2 pr-3 font-medium">Grade</th>
                  <th className="py-2 pr-3 font-medium">Class</th>
                  <th className="py-2 pr-3 font-medium">Form teacher</th>
                  <th className="py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="py-2 pr-3">{gradeLabel(row.grade)}</td>
                    <td className="py-2 pr-3">{row.className}</td>
                    <td className="py-2 pr-3">
                      {row.teacher.name}
                      {row.teacher.email || row.teacher.teacherProfile?.email ? (
                        <span className="text-slate-500">
                          {" "}
                          · {row.teacher.email || row.teacher.teacherProfile?.email}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2">
                      <button
                        type="button"
                        onClick={() => void handleDelete(row.id)}
                        className="text-sm font-medium text-red-700 hover:underline"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
