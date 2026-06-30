"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ListPagination } from "@/components/ui/ListPagination";
import { PageHeader } from "@/components/ui/PageHeader";
import { UsersSubnav } from "@/components/users/UsersSubnav";
import { LIST_PAGE_SIZES } from "@/lib/pagination";
import { USERS_MODULE_DESCRIPTION } from "@/lib/navigation/module-descriptions";

interface SubjectOption {
  id: string;
  code: string;
  name: string;
}

interface TeacherRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  status: string;
  subjects: Array<{ id: string; name: string; code: string }>;
  grades: string[];
  classes: string[];
}

interface TeacherFormState {
  name: string;
  email: string;
  phone: string;
  grades: string;
  classes: string;
  subjectCodes: string;
  status: "ACTIVE" | "INACTIVE";
  isActive: boolean;
}

const emptyForm = (): TeacherFormState => ({
  name: "",
  email: "",
  phone: "",
  grades: "",
  classes: "",
  subjectCodes: "",
  status: "ACTIVE",
  isActive: true,
});

const inputClass = "w-full rounded border border-slate-300 px-3 py-2 text-sm";
const filterClass = "rounded border border-slate-300 px-3 py-2 text-sm";
const buttonClass =
  "rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50";
const primaryButtonClass =
  "rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800";

function splitCommaList(value: string) {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function buildFilterParams(filters: {
  q: string;
  status: string;
  grade: string;
  className: string;
}) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status) params.set("status", filters.status);
  if (filters.grade) params.set("grade", filters.grade);
  if (filters.className) params.set("className", filters.className);
  return params;
}

export function TeacherUsersManager() {
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(LIST_PAGE_SIZES[0]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TeacherFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState({
    q: "",
    status: "ACTIVE",
    grade: "",
    className: "",
  });

  const updateFilters = useCallback((patch: Partial<typeof filters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  }, []);

  useEffect(() => {
    void fetch("/api/subjects")
      .then((response) => response.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setSubjects(
            data.map((row: SubjectOption) => ({
              id: row.id,
              code: row.code,
              name: row.name,
            })),
          );
        }
      })
      .catch(() => setSubjects([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = buildFilterParams(filters);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));

    try {
      const response = await fetch(`/api/admin/users/teachers?${params.toString()}`);
      const text = await response.text();
      const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Failed to load teachers");
      }
      setTeachers(Array.isArray(data.teachers) ? (data.teachers as TeacherRow[]) : []);
      setTotal(typeof data.total === "number" ? data.total : 0);
      setTotalPages(typeof data.totalPages === "number" ? data.totalPages : 0);
      if (typeof data.page === "number") setPage(data.page);
    } catch (loadError) {
      setTeachers([]);
      setTotal(0);
      setTotalPages(0);
      setError(loadError instanceof Error ? loadError.message : "Failed to load teachers");
    } finally {
      setLoading(false);
    }
  }, [filters, page, pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  const exportHref = useMemo(() => {
    const params = buildFilterParams(filters);
    return `/api/admin/users/teachers/export?${params.toString()}`;
  }, [filters]);

  function resolveSubjectIds(codes: string[]) {
    const byCode = new Map(subjects.map((subject) => [subject.code.toLowerCase(), subject.id]));
    const ids: string[] = [];
    const missing: string[] = [];
    for (const code of codes) {
      const id = byCode.get(code.toLowerCase());
      if (id) ids.push(id);
      else missing.push(code);
    }
    return { ids, missing };
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setModalOpen(true);
  }

  function openEdit(row: TeacherRow) {
    setEditingId(row.id);
    setForm({
      name: row.name,
      email: row.email ?? "",
      phone: row.phone ?? "",
      grades: row.grades.join(", "),
      classes: row.classes.join(", "),
      subjectCodes: row.subjects.map((subject) => subject.code).join(", "),
      status: (row.status as TeacherFormState["status"]) || "ACTIVE",
      isActive: row.isActive,
    });
    setModalOpen(true);
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    const codes = splitCommaList(form.subjectCodes);
    const { ids: subjectIds, missing } = resolveSubjectIds(codes);
    if (missing.length > 0) {
      setError(`Unknown subject codes: ${missing.join(", ")}`);
      setSaving(false);
      return;
    }

    const payload = {
      name: form.name.trim(),
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      grades: splitCommaList(form.grades),
      classes: splitCommaList(form.classes),
      subjectIds,
      status: form.status,
      isActive: form.isActive,
    };

    try {
      const response = await fetch(
        editingId ? `/api/admin/users/teachers/${editingId}` : "/api/admin/users/teachers",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Save failed");
      }
      setModalOpen(false);
      setMessage(editingId ? "Teacher updated." : "Teacher created.");
      void load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function setActive(id: string, isActive: boolean) {
    setError(null);
    setMessage(null);
    const response = await fetch(`/api/admin/users/teachers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(typeof data.error === "string" ? data.error : "Update failed");
      return;
    }
    setMessage(isActive ? "Teacher activated." : "Teacher deactivated.");
    void load();
  }

  async function resetPassword(id: string) {
    setError(null);
    setMessage(null);
    const response = await fetch(`/api/admin/users/teachers/${id}/reset-password`, {
      method: "POST",
    });
    const data = await response.json();
    if (!response.ok) {
      setError(typeof data.error === "string" ? data.error : "Reset failed");
      return;
    }
    setMessage(typeof data.message === "string" ? data.message : "Password reset email sent.");
  }

  return (
    <div className="space-y-4">
      <UsersSubnav />
      <PageHeader
        title="Teacher Users"
        description={`${USERS_MODULE_DESCRIPTION} Manage subject teacher accounts, subject assignments, and visible grades/classes.`}
        action={
          <div className="flex flex-wrap gap-2">
            <a href={exportHref} className={buttonClass}>
              Export
            </a>
            <button type="button" onClick={openCreate} className={primaryButtonClass}>
              New teacher
            </button>
          </div>
        }
      />

      <div className="space-y-4 border border-slate-200 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <input
            placeholder="Search"
            value={filters.q}
            onChange={(e) => updateFilters({ q: e.target.value })}
            className={filterClass}
          />
          <select
            value={filters.status}
            onChange={(e) => updateFilters({ status: e.target.value })}
            className={filterClass}
          >
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="ALL">All statuses</option>
          </select>
          <input
            placeholder="Grade"
            value={filters.grade}
            onChange={(e) => updateFilters({ grade: e.target.value })}
            className={filterClass}
          />
          <input
            placeholder="Class"
            value={filters.className}
            onChange={(e) => updateFilters({ className: e.target.value })}
            className={filterClass}
          />
          <button type="button" onClick={() => void load()} className={primaryButtonClass}>
            Search
          </button>
        </div>

        {message ? <p className="text-sm text-green-700">{message}</p> : null}
        {error ? <p className="text-sm text-red-700">{error}</p> : null}

        {loading && teachers.length === 0 ? (
          <p className="text-sm text-slate-500">Loading...</p>
        ) : teachers.length === 0 ? (
          <p className="text-sm text-slate-500">No teachers match the current filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse border border-slate-200 text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-600">
                  <th className="border border-slate-200 px-3 py-2">Name</th>
                  <th className="border border-slate-200 px-3 py-2">Email</th>
                  <th className="border border-slate-200 px-3 py-2">Subjects</th>
                  <th className="border border-slate-200 px-3 py-2">Grades</th>
                  <th className="border border-slate-200 px-3 py-2">Classes</th>
                  <th className="border border-slate-200 px-3 py-2">Status</th>
                  <th className="border border-slate-200 px-3 py-2">Login</th>
                  <th className="border border-slate-200 px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((row) => (
                  <tr key={row.id} className="border-b border-slate-200">
                    <td className="border border-slate-200 px-3 py-2">{row.name}</td>
                    <td className="border border-slate-200 px-3 py-2">{row.email ?? "—"}</td>
                    <td className="border border-slate-200 px-3 py-2">
                      {row.subjects.length > 0
                        ? row.subjects.map((subject) => subject.code).join(", ")
                        : "—"}
                    </td>
                    <td className="border border-slate-200 px-3 py-2">
                      {row.grades.length > 0 ? row.grades.join(", ") : "—"}
                    </td>
                    <td className="border border-slate-200 px-3 py-2">
                      {row.classes.length > 0 ? row.classes.join(", ") : "—"}
                    </td>
                    <td className="border border-slate-200 px-3 py-2">{row.status}</td>
                    <td className="border border-slate-200 px-3 py-2">
                      {row.isActive ? "Active" : "Inactive"}
                    </td>
                    <td className="border border-slate-200 px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(row)}
                          className="text-indigo-700 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void setActive(row.id, !row.isActive)}
                          className="text-slate-700 hover:underline"
                        >
                          {row.isActive ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void resetPassword(row.id)}
                          className="text-slate-700 hover:underline"
                        >
                          Reset password
                        </button>
                      </div>
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
          itemLabel="teachers"
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto border border-slate-300 bg-white p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-slate-900">
              {editingId ? "Edit teacher" : "New teacher"}
            </h2>
            <form onSubmit={(e) => void handleSave(e)} className="mt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm text-slate-700 sm:col-span-2">
                  Name *
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    className={`mt-1 ${inputClass}`}
                  />
                </label>
                <label className="block text-sm text-slate-700">
                  Email
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                    className={`mt-1 ${inputClass}`}
                  />
                </label>
                <label className="block text-sm text-slate-700">
                  Phone
                  <input
                    value={form.phone}
                    onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                    className={`mt-1 ${inputClass}`}
                  />
                </label>
                <label className="block text-sm text-slate-700">
                  Grades (comma-separated)
                  <input
                    value={form.grades}
                    onChange={(e) => setForm((prev) => ({ ...prev, grades: e.target.value }))}
                    className={`mt-1 ${inputClass}`}
                    placeholder="10, 11, 12"
                  />
                </label>
                <label className="block text-sm text-slate-700">
                  Classes (comma-separated)
                  <input
                    value={form.classes}
                    onChange={(e) => setForm((prev) => ({ ...prev, classes: e.target.value }))}
                    className={`mt-1 ${inputClass}`}
                    placeholder="A, B, C"
                  />
                </label>
                <label className="block text-sm text-slate-700 sm:col-span-2">
                  Subject codes (comma-separated)
                  <input
                    value={form.subjectCodes}
                    onChange={(e) => setForm((prev) => ({ ...prev, subjectCodes: e.target.value }))}
                    className={`mt-1 ${inputClass}`}
                    placeholder="0580, 9709"
                  />
                </label>
                <label className="block text-sm text-slate-700">
                  Profile status
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        status: e.target.value as TeacherFormState["status"],
                      }))
                    }
                    className={`mt-1 ${inputClass}`}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 pt-6 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                  />
                  Login active
                </label>
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className={buttonClass}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" className={primaryButtonClass} disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
