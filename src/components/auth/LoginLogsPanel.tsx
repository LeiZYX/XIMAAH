"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { ListPagination } from "@/components/ui/ListPagination";
import { PageHeader } from "@/components/ui/PageHeader";
import { readJsonResponse } from "@/lib/client/fetch-json";

type LoginLogRow = {
  id: string;
  occurredAt: string;
  lastAttemptAt: string;
  result: "SUCCESS" | "FAILED" | "LOGOUT";
  failureReason: "INVALID_CREDENTIALS" | "INACTIVE" | "FEATURE_DISABLED" | null;
  attemptCount: number;
  name: string | null;
  role: string | null;
  identifier: string;
  ipAddress: string;
};

type LoginLogResponse = {
  from: string;
  to: string;
  logs: LoginLogRow[];
  total: number;
  page: number;
  totalPages: number;
  pageSize: number;
  error?: string;
};

function shanghaiToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDays(date: string, days: number): string {
  const start = new Date(`${date}T00:00:00.000+08:00`);
  start.setUTCDate(start.getUTCDate() + days);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(start);
}

function formatWhen(value: string): string {
  return new Date(value).toLocaleString("en-GB", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatClock(value: string): string {
  return new Date(value).toLocaleTimeString("en-GB", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function roleLabel(role: string | null): string {
  switch (role) {
    case "ADMIN":
      return "Admin";
    case "EXAM_OFFICER":
      return "Exam Officer";
    case "SUBJECT_TEACHER":
      return "Teacher";
    case "STUDENT":
      return "Student";
    case "FINANCE":
      return "Finance";
    default:
      return "—";
  }
}

function resultLabel(result: LoginLogRow["result"]): string {
  switch (result) {
    case "SUCCESS":
      return "Success";
    case "FAILED":
      return "Failed";
    case "LOGOUT":
      return "Logged out";
  }
}

function resultClass(result: LoginLogRow["result"]): string {
  switch (result) {
    case "SUCCESS":
      return "bg-green-100 text-green-800";
    case "FAILED":
      return "bg-red-100 text-red-800";
    case "LOGOUT":
      return "bg-slate-100 text-slate-600";
  }
}

function noteFor(row: LoginLogRow): string {
  if (row.result !== "FAILED") return "";
  const reason =
    row.failureReason === "INACTIVE"
      ? "Account inactive"
      : row.failureReason === "FEATURE_DISABLED"
        ? "Student login disabled"
        : "Invalid credentials";
  if (row.attemptCount <= 1) return reason;
  return `${reason} · ${row.attemptCount} attempts · last ${formatClock(row.lastAttemptAt)}`;
}

export function LoginLogsPanel() {
  const today = shanghaiToday();
  const [from, setFrom] = useState(addDays(today, -6));
  const [to, setTo] = useState(today);
  const [result, setResult] = useState("");
  const [role, setRole] = useState("");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [logs, setLogs] = useState<LoginLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => window.clearTimeout(timeoutId);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({
      from,
      to,
      page: String(page),
      pageSize: String(pageSize),
    });
    if (result) params.set("result", result);
    if (role) params.set("role", role);
    if (debouncedQuery) params.set("q", debouncedQuery);

    setLoading(true);
    void (async () => {
      try {
        const response = await fetch(`/api/login-logs?${params.toString()}`);
        const body = await readJsonResponse<LoginLogResponse>(response);
        if (!response.ok) throw new Error(body.error ?? "Could not load login logs");
        if (cancelled) return;
        setLogs(body.logs);
        setTotal(body.total);
        setTotalPages(body.totalPages);
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setLogs([]);
          setError(err instanceof Error ? err.message : "Could not load login logs");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [from, to, result, role, debouncedQuery, page, pageSize]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Login Logs"
        description="Failed attempts from the same IP and login name within one minute are kept as one row. Success and logout are kept for two years. Failures are kept for 90 days."
      />
      <Card>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">From</span>
            <input
              type="date"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">To</span>
            <input
              type="date"
              value={to}
              onChange={(event) => {
                setTo(event.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Result</span>
            <select
              value={result}
              onChange={(event) => {
                setResult(event.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">All</option>
              <option value="SUCCESS">Success</option>
              <option value="FAILED">Failed</option>
              <option value="LOGOUT">Logged out</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Role</span>
            <select
              value={role}
              onChange={(event) => {
                setRole(event.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">All</option>
              <option value="ADMIN">Admin</option>
              <option value="EXAM_OFFICER">Exam Officer</option>
              <option value="SUBJECT_TEACHER">Teacher</option>
              <option value="STUDENT">Student</option>
              <option value="FINANCE">Finance</option>
            </select>
          </label>
          <label className="min-w-[16rem] flex-1 text-sm">
            <span className="mb-1 block text-slate-600">Search</span>
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Search English, Chinese, pinyin, or email"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              aria-label="Search English, Chinese, pinyin, or email"
            />
          </label>
        </div>

        {error ? <p className="mb-3 text-sm text-red-700">{error}</p> : null}

        {loading && logs.length === 0 ? (
          <p className="text-sm text-slate-500">Loading...</p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-slate-500">No login records in this range.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600">
                  <th className="py-2 pr-4 font-medium">Time</th>
                  <th className="py-2 pr-4 font-medium">Result</th>
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Role</th>
                  <th className="py-2 pr-4 font-medium">Login name</th>
                  <th className="py-2 pr-4 font-medium">IP</th>
                  <th className="py-2 font-medium">Note</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="py-2 pr-4 whitespace-nowrap text-slate-700">
                      {formatWhen(row.lastAttemptAt)}
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${resultClass(row.result)}`}
                      >
                        {resultLabel(row.result)}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-slate-900">{row.name?.trim() || "—"}</td>
                    <td className="py-2 pr-4">{roleLabel(row.role)}</td>
                    <td className="py-2 pr-4">{row.identifier || "—"}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">{row.ipAddress || "—"}</td>
                    <td className="py-2 text-slate-600">{noteFor(row)}</td>
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
          itemLabel="records"
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
