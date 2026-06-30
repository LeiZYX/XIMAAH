"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { useRegistrationsRefresh } from "@/components/registrations/registrations-refresh";
import { includesNormalRegistrations } from "@/lib/registrations/workspace-type-filters";
import {
  changeRequestTypeLabel,
  formatExamSessionSummary,
} from "@/components/registrations/TeacherChangeRequestModal";

interface PendingChangeRequest {
  id: string;
  requestType: string;
  reason: string;
  createdAt: string;
  registrationWorkspaceId: string | null;
  requestedBy: { name: string };
  targetExamSession: {
    date: string;
    startTime: string | null;
    paper: { code: string; title: string };
  } | null;
  student: {
    name: string;
    studentProfile: { studentNo: string } | null;
  };
  registrationWorkspace: {
    registrationWindow: {
      title: string;
      examBoard: { name: string };
      examSeries: { name: string; year: number };
    };
  } | null;
  registrationWindow: {
    title: string;
    examBoard: { name: string };
    examSeries: { name: string; year: number };
  } | null;
  examSessions: Array<{
    examSession: {
      date: string;
      startTime: string | null;
      paper: { code: string; title: string };
    };
  }>;
}

export function PendingTeacherChangeRequests({
  apiPath,
  detailBasePath,
  approveApiBase,
}: {
  apiPath: string;
  detailBasePath: string;
  approveApiBase: string;
}) {
  const [rows, setRows] = useState<PendingChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { bumpWorkspaceList, registrationWindowId, registrationTypes } = useRegistrationsRefresh();
  const showPanel = includesNormalRegistrations(registrationTypes);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: "PENDING" });
      if (registrationWindowId) {
        params.set("registrationWindowId", registrationWindowId);
      }
      const response = await fetch(`${apiPath}?${params.toString()}`);
      const data = await response.json();
      setRows(response.ok && Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [apiPath, registrationWindowId]);

  useEffect(() => {
    load();
  }, [load]);

  async function review(requestId: string, decision: "APPROVED" | "REJECTED", note?: string) {
    setActingId(requestId);
    setError(null);
    try {
      const path =
        decision === "APPROVED"
          ? `${approveApiBase}/${requestId}/approve`
          : `${approveApiBase}/${requestId}/reject`;
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: decision === "REJECTED" ? JSON.stringify({ reviewNote: note }) : "{}",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Could not review request");
      }
      setRejectingId(null);
      setRejectNote("");
      await load();
      bumpWorkspaceList();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Could not review request");
    } finally {
      setActingId(null);
    }
  }

  if (!showPanel) return null;
  if (loading) return null;
  if (rows.length === 0) return null;

  function windowInfo(row: PendingChangeRequest) {
    return row.registrationWorkspace?.registrationWindow ?? row.registrationWindow;
  }

  function examsLabel(row: PendingChangeRequest) {
    if (row.requestType === "LATE_REGISTRATION") {
      if (row.examSessions.length === 0) return "—";
      return row.examSessions
        .map((item) => formatExamSessionSummary(item.examSession))
        .join("; ");
    }
    return formatExamSessionSummary(row.targetExamSession);
  }

  return (
    <Card className="border-amber-200 bg-amber-50/50">
      <h2 className="mb-1 text-lg font-semibold text-slate-900">Pending teacher requests</h2>
      <p className="mb-3 text-sm text-slate-600">
        Review teacher change requests and late registration requests.
      </p>
      {error ? (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead>
            <tr className="border-b border-amber-200 text-slate-600">
              <th className="py-2 pr-4 font-medium">Student</th>
              <th className="py-2 pr-4 font-medium">Registration</th>
              <th className="py-2 pr-4 font-medium">Type</th>
              <th className="py-2 pr-4 font-medium">Exams</th>
              <th className="py-2 pr-4 font-medium">Teacher</th>
              <th className="py-2 pr-4 font-medium">Submitted</th>
              <th className="py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const window = windowInfo(row);
              return (
                <tr key={row.id} className="border-b border-amber-100 align-top">
                  <td className="py-2 pr-4">
                    {row.student.name}
                    <span className="block text-xs text-slate-500">
                      {row.student.studentProfile?.studentNo ?? "—"}
                    </span>
                  </td>
                  <td className="py-2 pr-4">
                    {window?.title ?? "—"}
                    <span className="block text-xs text-slate-500">
                      {window?.examBoard.name ?? "—"}
                    </span>
                  </td>
                  <td className="py-2 pr-4">{changeRequestTypeLabel(row.requestType)}</td>
                  <td className="py-2 pr-4 max-w-xs">{examsLabel(row)}</td>
                  <td className="py-2 pr-4">{row.requestedBy.name}</td>
                  <td className="py-2 pr-4">{new Date(row.createdAt).toLocaleString()}</td>
                  <td className="py-2">
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={actingId === row.id}
                          onClick={() => review(row.id, "APPROVED")}
                          className="rounded-lg bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={actingId === row.id}
                          onClick={() => setRejectingId(row.id)}
                          className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          Reject
                        </button>
                        {row.registrationWorkspaceId ? (
                          <Link
                            href={`${detailBasePath}/${row.registrationWorkspaceId}`}
                            className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
                          >
                            Detail
                          </Link>
                        ) : null}
                      </div>
                      {rejectingId === row.id ? (
                        <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-2">
                          <textarea
                            value={rejectNote}
                            onChange={(e) => setRejectNote(e.target.value)}
                            rows={2}
                            placeholder="Review note (required)"
                            className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={actingId === row.id}
                              onClick={() => review(row.id, "REJECTED", rejectNote)}
                              className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRejectingId(null);
                                setRejectNote("");
                              }}
                              className="rounded border border-slate-300 px-2 py-1 text-xs"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
