"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { CandidateLifecycleActions } from "@/components/candidates/CandidateLifecycleActions";
import { SetPasswordModal } from "@/components/users/SetPasswordModal";
import { ListPagination } from "@/components/ui/ListPagination";
import { PageHeader } from "@/components/ui/PageHeader";
import { UsersSubnav } from "@/components/users/UsersSubnav";
import { LIST_PAGE_SIZES } from "@/lib/pagination";
import { USERS_MODULE_DESCRIPTION } from "@/lib/navigation/module-descriptions";
import { studentStatusLabel } from "@/lib/students/labels";
import { GENDER_VALUES, GRADE_VALUES } from "@/lib/students/profile-enums";

interface StudentRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  studentNo: string | null;
  candidateId: string | null;
  candidateNumber: string | null;
  studentId: string | null;
  chineseName: string | null;
  pinyinLastName: string | null;
  pinyinFirstName: string | null;
  idNumber: string | null;
  passportNumber: string | null;
  dateOfBirth: string | null;
  idCardNumber: string | null;
  gender: string | null;
  grade: string | null;
  className: string | null;
  status: string;
  studentType: string;
}

interface StudentFormState {
  englishName: string;
  chineseName: string;
  pinyinLastName: string;
  pinyinFirstName: string;
  studentNumber: string;
  candidateNumber: string;
  idNumber: string;
  passportNumber: string;
  dateOfBirth: string;
  gender: "" | "MALE" | "FEMALE" | "OTHER" | "UNKNOWN";
  email: string;
  phone: string;
  grade: "" | "G9" | "G10" | "G11" | "G12";
  className: string;
  status: "ACTIVE" | "GRADUATED" | "LEFT" | "INACTIVE";
  isActive: boolean;
}

const emptyForm = (): StudentFormState => ({
  englishName: "",
  chineseName: "",
  pinyinLastName: "",
  pinyinFirstName: "",
  studentNumber: "",
  candidateNumber: "",
  idNumber: "",
  passportNumber: "",
  dateOfBirth: "",
  gender: "",
  email: "",
  phone: "",
  grade: "",
  className: "",
  status: "ACTIVE",
  isActive: true,
});

const inputClass = "w-full rounded border border-slate-300 px-3 py-2 text-sm";
const filterClass = "rounded border border-slate-300 px-3 py-2 text-sm";
const buttonClass =
  "rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50";
const primaryButtonClass =
  "rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800";

function genderLabel(gender: string | null) {
  if (gender === "MALE") return "Male";
  if (gender === "FEMALE") return "Female";
  if (gender === "OTHER") return "Other";
  if (gender === "UNKNOWN") return "Unknown";
  return "—";
}

function buildFilterParams(filters: {
  q: string;
  grade: string;
  className: string;
  status: string;
  studentType: string;
}) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.grade) params.set("grade", filters.grade);
  if (filters.className) params.set("className", filters.className);
  if (filters.status) params.set("status", filters.status);
  if (filters.studentType) params.set("studentType", filters.studentType);
  return params;
}

export function StudentUsersManager() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(LIST_PAGE_SIZES[0]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<StudentFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [setPasswordUser, setSetPasswordUser] = useState<StudentRow | null>(null);
  const [filters, setFilters] = useState({
    q: "",
    grade: "",
    className: "",
    status: "ACTIVE",
    studentType: "",
  });

  const updateFilters = useCallback((patch: Partial<typeof filters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = buildFilterParams(filters);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));

    try {
      const response = await fetch(`/api/admin/users/students?${params.toString()}`);
      const text = await response.text();
      const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Failed to load students");
      }
      const rows = Array.isArray(data.students) ? (data.students as StudentRow[]) : [];
      setStudents(rows);
      setTotal(typeof data.total === "number" ? data.total : 0);
      setTotalPages(typeof data.totalPages === "number" ? data.totalPages : 0);
      if (typeof data.page === "number") setPage(data.page);
      setSelectedIds((prev) => {
        const next = new Set<string>();
        for (const row of rows) {
          if (prev.has(row.id)) next.add(row.id);
        }
        return next;
      });
    } catch (loadError) {
      setStudents([]);
      setTotal(0);
      setTotalPages(0);
      setError(loadError instanceof Error ? loadError.message : "Failed to load students");
    } finally {
      setLoading(false);
    }
  }, [filters, page, pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  const exportHref = useMemo(() => {
    const params = buildFilterParams(filters);
    return `/api/admin/users/students/export?${params.toString()}`;
  }, [filters]);

  const allSelected = students.length > 0 && students.every((row) => selectedIds.has(row.id));

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(students.map((row) => row.id)));
  }

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setModalOpen(true);
  }

  function openEdit(row: StudentRow) {
    setEditingId(row.id);
    setForm({
      englishName: row.name,
      chineseName: row.chineseName ?? "",
      pinyinLastName: row.pinyinLastName ?? "",
      pinyinFirstName: row.pinyinFirstName ?? "",
      studentNumber: row.studentNo ?? "",
      candidateNumber: row.candidateNumber ?? "",
      idNumber: row.idNumber ?? row.idCardNumber ?? "",
      passportNumber: row.passportNumber ?? "",
      dateOfBirth: row.dateOfBirth ?? "",
      gender: (row.gender as StudentFormState["gender"]) || "",
      email: row.email ?? "",
      phone: row.phone ?? "",
      grade: (row.grade as StudentFormState["grade"]) || "",
      className: row.className ?? "",
      status: (row.status as StudentFormState["status"]) || "ACTIVE",
      isActive: row.isActive,
    });
    setModalOpen(true);
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    const payload = {
      englishName: form.englishName.trim(),
      chineseName: form.chineseName.trim() || undefined,
      pinyinLastName: form.pinyinLastName.trim() || undefined,
      pinyinFirstName: form.pinyinFirstName.trim() || undefined,
      studentNumber: form.studentNumber.trim() || undefined,
      candidateNumber: form.candidateNumber.trim() || undefined,
      idNumber: form.idNumber.trim() || undefined,
      passportNumber: form.passportNumber.trim() || undefined,
      dateOfBirth: form.dateOfBirth.trim() || undefined,
      gender: form.gender || undefined,
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      grade: form.grade,
      className: form.className.trim(),
      status: form.status,
      isActive: form.isActive,
    };

    try {
      const response = await fetch(
        editingId ? `/api/admin/users/students/${editingId}` : "/api/admin/users/students",
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
      setMessage(editingId ? "Student updated." : "Student created.");
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
    const response = await fetch(`/api/admin/users/students/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(typeof data.error === "string" ? data.error : "Update failed");
      return;
    }
    setMessage(isActive ? "Student activated." : "Student deactivated.");
    void load();
  }

  async function resetPassword(id: string) {
    setError(null);
    setMessage(null);
    const response = await fetch(`/api/admin/users/students/${id}/reset-password`, {
      method: "POST",
    });
    const data = await response.json();
    if (!response.ok) {
      setError(typeof data.error === "string" ? data.error : "Reset failed");
      return;
    }
    setMessage(typeof data.message === "string" ? data.message : "Password reset email sent.");
  }

  async function submitForceSetPassword(password: string, confirmPassword: string) {
    if (!setPasswordUser) return "No user selected";
    const response = await fetch(`/api/admin/users/${setPasswordUser.id}/force-set-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, confirmPassword }),
    });
    const data = await response.json();
    if (!response.ok) {
      return typeof data.error === "string" ? data.error : "Could not set password";
    }
    setMessage(typeof data.message === "string" ? data.message : "Password has been updated successfully.");
    return null;
  }

  return (
    <div className="space-y-4">
      <UsersSubnav />
      <PageHeader
        title="Student Users"
        description={`${USERS_MODULE_DESCRIPTION} Create and maintain student login identities, class placement, and account status.`}
        action={
          <div className="flex flex-wrap gap-2">
            <a href={exportHref} className={buttonClass}>
              Export
            </a>
            <button type="button" onClick={openCreate} className={primaryButtonClass}>
              New student
            </button>
          </div>
        }
      />

      <div className="space-y-4 border border-slate-200 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <input
            placeholder="Search"
            value={filters.q}
            onChange={(e) => updateFilters({ q: e.target.value })}
            className={filterClass}
          />
          <select
            value={filters.grade}
            onChange={(e) => updateFilters({ grade: e.target.value })}
            className={filterClass}
          >
            <option value="">All grades</option>
            {GRADE_VALUES.map((grade) => (
              <option key={grade} value={grade}>
                {grade}
              </option>
            ))}
          </select>
          <input
            placeholder="Class"
            value={filters.className}
            onChange={(e) => updateFilters({ className: e.target.value })}
            className={filterClass}
          />
          <select
            value={filters.status}
            onChange={(e) => updateFilters({ status: e.target.value })}
            className={filterClass}
          >
            <option value="ACTIVE">Active</option>
            <option value="GRADUATED">Graduated</option>
            <option value="LEFT">Left</option>
            <option value="INACTIVE">Inactive</option>
            <option value="ALL">All statuses</option>
          </select>
          <select
            value={filters.studentType}
            onChange={(e) => updateFilters({ studentType: e.target.value })}
            className={filterClass}
          >
            <option value="">All types</option>
            <option value="INTERNAL">Internal</option>
            <option value="EXTERNAL">External</option>
          </select>
          <button type="button" onClick={() => void load()} className={primaryButtonClass}>
            Search
          </button>
        </div>

        {message ? <p className="text-sm text-green-700">{message}</p> : null}
        {error ? <p className="text-sm text-red-700">{error}</p> : null}

        {loading && students.length === 0 ? (
          <p className="text-sm text-slate-500">Loading...</p>
        ) : students.length === 0 ? (
          <p className="text-sm text-slate-500">No students match the current filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse border border-slate-200 text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-600">
                  <th className="border border-slate-200 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label="Select all students"
                    />
                  </th>
                  <th className="border border-slate-200 px-3 py-2">Student ID</th>
                  <th className="border border-slate-200 px-3 py-2">Student No.</th>
                  <th className="border border-slate-200 px-3 py-2">English name</th>
                  <th className="border border-slate-200 px-3 py-2">Chinese name</th>
                  <th className="border border-slate-200 px-3 py-2">ID card</th>
                  <th className="border border-slate-200 px-3 py-2">Gender</th>
                  <th className="border border-slate-200 px-3 py-2">Grade / Class</th>
                  <th className="border border-slate-200 px-3 py-2">Status</th>
                  <th className="border border-slate-200 px-3 py-2">Login</th>
                  <th className="border border-slate-200 px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((row) => (
                  <tr key={row.id} className="border-b border-slate-200">
                    <td className="border border-slate-200 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.id)}
                        onChange={() => toggleRow(row.id)}
                        aria-label={`Select ${row.name}`}
                      />
                    </td>
                    <td className="border border-slate-200 px-3 py-2 font-mono text-xs">
                      {row.studentId ?? "—"}
                    </td>
                    <td className="border border-slate-200 px-3 py-2">{row.studentNo ?? "—"}</td>
                    <td className="border border-slate-200 px-3 py-2">{row.name}</td>
                    <td className="border border-slate-200 px-3 py-2">{row.chineseName ?? "—"}</td>
                    <td className="border border-slate-200 px-3 py-2">{row.idCardNumber ?? "—"}</td>
                    <td className="border border-slate-200 px-3 py-2">{genderLabel(row.gender)}</td>
                    <td className="border border-slate-200 px-3 py-2">
                      {row.grade ?? "—"} / {row.className ?? "—"}
                    </td>
                    <td className="border border-slate-200 px-3 py-2">
                      {studentStatusLabel(row.status as never)}
                    </td>
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
                        <button
                          type="button"
                          onClick={() => setSetPasswordUser(row)}
                          className="text-slate-700 hover:underline"
                        >
                          Set password
                        </button>
                        {row.candidateId ? (
                          <CandidateLifecycleActions
                            candidateId={row.candidateId}
                            apiPath="/api/admin/candidates"
                            status={row.status}
                            canArchive
                            canDelete
                            onChanged={() => void load()}
                            onDeleted={() => void load()}
                          />
                        ) : null}
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
          itemLabel="students"
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
              {editingId ? "Edit student" : "New student"}
            </h2>
            <form onSubmit={(e) => void handleSave(e)} className="mt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm text-slate-700">
                  Chinese name *
                  <input
                    required
                    value={form.chineseName}
                    onChange={(e) => setForm((prev) => ({ ...prev, chineseName: e.target.value }))}
                    className={`mt-1 ${inputClass}`}
                  />
                </label>
                <label className="block text-sm text-slate-700">
                  English name *
                  <input
                    required
                    value={form.englishName}
                    onChange={(e) => setForm((prev) => ({ ...prev, englishName: e.target.value }))}
                    className={`mt-1 ${inputClass}`}
                  />
                </label>
                <label className="block text-sm text-slate-700">
                  Pinyin last name *
                  <input
                    required
                    value={form.pinyinLastName}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, pinyinLastName: e.target.value }))
                    }
                    className={`mt-1 ${inputClass}`}
                  />
                </label>
                <label className="block text-sm text-slate-700">
                  Pinyin first name *
                  <input
                    required
                    value={form.pinyinFirstName}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, pinyinFirstName: e.target.value }))
                    }
                    className={`mt-1 ${inputClass}`}
                  />
                </label>
                <label className="block text-sm text-slate-700">
                  Candidate number
                  <input
                    value={form.candidateNumber}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, candidateNumber: e.target.value }))
                    }
                    className={`mt-1 ${inputClass}`}
                  />
                </label>
                <label className="block text-sm text-slate-700">
                  Student number
                  <input
                    value={form.studentNumber}
                    onChange={(e) => setForm((prev) => ({ ...prev, studentNumber: e.target.value }))}
                    className={`mt-1 ${inputClass}`}
                  />
                </label>
                <label className="block text-sm text-slate-700">
                  ID number
                  <input
                    value={form.idNumber}
                    onChange={(e) => setForm((prev) => ({ ...prev, idNumber: e.target.value }))}
                    className={`mt-1 ${inputClass}`}
                  />
                </label>
                <label className="block text-sm text-slate-700">
                  Passport number
                  <input
                    value={form.passportNumber}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, passportNumber: e.target.value }))
                    }
                    className={`mt-1 ${inputClass}`}
                  />
                </label>
                <label className="block text-sm text-slate-700">
                  Gender *
                  <select
                    required
                    value={form.gender}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        gender: e.target.value as StudentFormState["gender"],
                      }))
                    }
                    className={`mt-1 ${inputClass}`}
                  >
                    <option value="">Select gender</option>
                    {GENDER_VALUES.map((gender) => (
                      <option key={gender} value={gender}>
                        {genderLabel(gender)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm text-slate-700">
                  Date of birth *
                  <input
                    required
                    type="date"
                    value={form.dateOfBirth}
                    onChange={(e) => setForm((prev) => ({ ...prev, dateOfBirth: e.target.value }))}
                    className={`mt-1 ${inputClass}`}
                  />
                </label>
                <label className="block text-sm text-slate-700">
                  Email *
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                    className={`mt-1 ${inputClass}`}
                  />
                </label>
                <label className="block text-sm text-slate-700">
                  Phone *
                  <input
                    required
                    value={form.phone}
                    onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                    className={`mt-1 ${inputClass}`}
                  />
                </label>
                <label className="block text-sm text-slate-700">
                  Grade *
                  <select
                    required
                    value={form.grade}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        grade: e.target.value as StudentFormState["grade"],
                      }))
                    }
                    className={`mt-1 ${inputClass}`}
                  >
                    <option value="">Select grade</option>
                    {GRADE_VALUES.map((grade) => (
                      <option key={grade} value={grade}>
                        {grade}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm text-slate-700">
                  Class *
                  <input
                    required
                    value={form.className}
                    onChange={(e) => setForm((prev) => ({ ...prev, className: e.target.value }))}
                    className={`mt-1 ${inputClass}`}
                  />
                </label>
                <label className="block text-sm text-slate-700">
                  Status
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        status: e.target.value as StudentFormState["status"],
                      }))
                    }
                    className={`mt-1 ${inputClass}`}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="GRADUATED">Graduated</option>
                    <option value="LEFT">Left</option>
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

      <SetPasswordModal
        open={Boolean(setPasswordUser)}
        userLabel={setPasswordUser?.name ?? "student"}
        onClose={() => setSetPasswordUser(null)}
        onSubmit={submitForceSetPassword}
      />
    </div>
  );
}
