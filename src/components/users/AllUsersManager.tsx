"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ListPagination } from "@/components/ui/ListPagination";
import { PageHeader } from "@/components/ui/PageHeader";
import { UsersSubnav } from "@/components/users/UsersSubnav";
import { LIST_PAGE_SIZES } from "@/lib/pagination";
import { USERS_MODULE_DESCRIPTION } from "@/lib/navigation/module-descriptions";

interface UserRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  username: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
  studentProfile: {
    studentNo: string | null;
    currentGrade: string | null;
    currentClassName: string | null;
    status: string;
  } | null;
  teacherProfile: { status: string } | null;
}

const ROLE_OPTIONS = [
  { value: "", label: "All roles" },
  { value: "ADMIN", label: "Admin" },
  { value: "EXAM_OFFICER", label: "Exam Officer" },
  { value: "SUBJECT_TEACHER", label: "Subject Teacher" },
  { value: "STUDENT", label: "Student" },
];

function roleLabel(role: string) {
  return ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role;
}

function roleManageHref(role: string) {
  if (role === "STUDENT") return "/admin/users/students";
  if (role === "SUBJECT_TEACHER") return "/admin/users/teachers";
  return null;
}

const inputClass = "rounded border border-slate-300 px-3 py-2 text-sm";
const buttonClass =
  "rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50";
const primaryButtonClass =
  "rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800";

export function AllUsersManager() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(LIST_PAGE_SIZES[0]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [filters, setFilters] = useState({ q: "", role: "" });

  const updateFilters = useCallback((patch: Partial<typeof filters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.role) params.set("role", filters.role);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));

    try {
      const response = await fetch(`/api/admin/users?${params.toString()}`);
      const text = await response.text();
      const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Failed to load users");
      }
      setUsers(Array.isArray(data.users) ? (data.users as UserRow[]) : []);
      setTotal(typeof data.total === "number" ? data.total : 0);
      setTotalPages(typeof data.totalPages === "number" ? data.totalPages : 0);
      if (typeof data.page === "number") setPage(data.page);
    } catch (loadError) {
      setUsers([]);
      setTotal(0);
      setTotalPages(0);
      setError(loadError instanceof Error ? loadError.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [filters, page, pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <UsersSubnav />
      <PageHeader
        title="All Users"
        description={`${USERS_MODULE_DESCRIPTION} Search and browse every account.`}
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/users/students" className={buttonClass}>
              Students
            </Link>
            <Link href="/admin/users/teachers" className={buttonClass}>
              Teachers
            </Link>
          </div>
        }
      />

      <div className="space-y-4 border border-slate-200 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            Search
            <input
              placeholder="Name, email, phone, username, student no."
              value={filters.q}
              onChange={(e) => updateFilters({ q: e.target.value })}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            Role
            <select
              value={filters.role}
              onChange={(e) => updateFilters({ role: e.target.value })}
              className={inputClass}
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => void load()} className={primaryButtonClass}>
            Search
          </button>
        </div>

        {error ? <p className="text-sm text-red-700">{error}</p> : null}

        {loading && users.length === 0 ? (
          <p className="text-sm text-slate-500">Loading...</p>
        ) : users.length === 0 ? (
          <p className="text-sm text-slate-500">No users match the current filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse border border-slate-200 text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-600">
                  <th className="border border-slate-200 px-3 py-2">Name</th>
                  <th className="border border-slate-200 px-3 py-2">Email</th>
                  <th className="border border-slate-200 px-3 py-2">Role</th>
                  <th className="border border-slate-200 px-3 py-2">Details</th>
                  <th className="border border-slate-200 px-3 py-2">Active</th>
                  <th className="border border-slate-200 px-3 py-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const manageHref = roleManageHref(user.role);
                  return (
                    <tr key={user.id} className="border-b border-slate-200">
                      <td className="border border-slate-200 px-3 py-2">
                        {manageHref ? (
                          <Link href={manageHref} className="text-indigo-700 hover:underline">
                            {user.name}
                          </Link>
                        ) : (
                          user.name
                        )}
                      </td>
                      <td className="border border-slate-200 px-3 py-2">{user.email ?? "—"}</td>
                      <td className="border border-slate-200 px-3 py-2">
                        {manageHref ? (
                          <Link href={manageHref} className="text-indigo-700 hover:underline">
                            {roleLabel(user.role)}
                          </Link>
                        ) : (
                          roleLabel(user.role)
                        )}
                      </td>
                      <td className="border border-slate-200 px-3 py-2 text-slate-600">
                        {user.role === "STUDENT" && user.studentProfile ? (
                          <span>
                            {user.studentProfile.studentNo ?? "—"} · {user.studentProfile.currentGrade ?? "—"}/
                            {user.studentProfile.currentClassName ?? "—"} · {user.studentProfile.status}
                          </span>
                        ) : user.role === "SUBJECT_TEACHER" && user.teacherProfile ? (
                          <span>{user.teacherProfile.status}</span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="border border-slate-200 px-3 py-2">
                        {user.isActive ? "Yes" : "No"}
                      </td>
                      <td className="border border-slate-200 px-3 py-2">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
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
          itemLabel="users"
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </div>
    </div>
  );
}
