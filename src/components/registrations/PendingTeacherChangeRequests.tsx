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
import { formatEnglishWithChineseName } from "@/lib/candidates/identity";

type ReviewTab = "needs" | "reviewed";

interface PendingChangeRequest {
  id: string;
  requestType: string;
  reason: string;
  status: string;
  createdAt: string;
  reviewedAt?: string | null;
  reviewNote?: string | null;
  registrationWorkspaceId: string | null;
  requestedBy: { name: string };
  reviewedBy?: { name: string } | null;
  targetExamSession: {
    date: string;
    startTime: string | null;
    paper: { code: string; title: string };
  } | null;
  student: {
    name: string;
    studentProfile: { studentNo: string } | null;
    candidate?: { chineseName?: string | null; englishName?: string | null } | null;
  };
  candidate?: { chineseName?: string | null; englishName?: string | null } | null;
  registrationWorkspace: {
    candidate?: { chineseName?: string | null; englishName?: string | null } | null;
    student?: {
      candidate?: { chineseName?: string | null; englishName?: string | null } | null;
    } | null;
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

function changeRequestStudentLabel(row: PendingChangeRequest): string {
  const chinese =
    row.candidate?.chineseName ||
    row.student.candidate?.chineseName ||
    row.registrationWorkspace?.candidate?.chineseName ||
    row.registrationWorkspace?.student?.candidate?.chineseName ||
    null;
  const english =
    row.candidate?.englishName ||
    row.student.candidate?.englishName ||
    row.student.name ||
    "";
  return formatEnglishWithChineseName(english, chinese);
}

function TabButton({
  active,
  count,
  label,
  onClick,
}: {
  active: boolean;
  count: number;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
        active
          ? "bg-indigo-600 text-white"
          : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      {label} ({count})
    </button>
  );
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
  const [tab, setTab] = useState<ReviewTab>("needs");
  const [needsRows, setNeedsRows] = useState<PendingChangeRequest[]>([]);
  const [reviewedRows, setReviewedRows] = useState<PendingChangeRequest[]>([]);
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
      const shared = new URLSearchParams();
      if (registrationWindowId) {
        shared.set("registrationWindowId", registrationWindowId);
      }

      const needsParams = new URLSearchParams(shared);
      needsParams.set("status", "PENDING");

      const reviewedParams = new URLSearchParams(shared);
      reviewedParams.set("status", "APPROVED,REJECTED");
      if (!registrationWindowId) {
        reviewedParams.set("take", "100");
      }

      const [needsRes, reviewedRes] = await Promise.all([
        fetch(`${apiPath}?${needsParams.toString()}`),
        fetch(`${apiPath}?${reviewedParams.toString()}`),
      ]);
      const needsData = await needsRes.json().catch(() => []);
      const reviewedData = await reviewedRes.json().catch(() => []);
      setNeedsRows(needsRes.ok && Array.isArray(needsData) ? needsData : []);
      setReviewedRows(reviewedRes.ok && Array.isArray(reviewedData) ? reviewedData : []);
    } catch {
      setNeedsRows([]);
      setReviewedRows([]);
    } finally {
      setLoading(false);
    }
  }, [apiPath, registrationWindowId]);

  useEffect(() => {
    void load();
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
      // Stay on Needs review so the officer can continue the remaining queue.
      await load();
      bumpWorkspaceList();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Could not review request");
    } finally {
      setActingId(null);
    }
  }

  if (!showPanel) return null;

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

  const rows = tab === "needs" ? needsRows : reviewedRows;

  return (
    <Card className="border-amber-200 bg-amber-50/50">
      <h2 className="mb-1 text-lg font-semibold text-slate-900">Teacher change requests</h2>
      <p className="mb-3 text-sm text-slate-600">
        Review teacher change requests and late registration requests.
      </p>
      <div className="mb-3 flex flex-wrap gap-2">
        <TabButton
          active={tab === "needs"}
          count={needsRows.length}
          label="Needs review"
          onClick={() => setTab("needs")}
        />
        <TabButton
          active={tab === "reviewed"}
          count={reviewedRows.length}
          label="Reviewed"
          onClick={() => setTab("reviewed")}
        />
      </div>
      {error ? (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500">
          {tab === "needs"
            ? "No teacher requests waiting for review."
            : "No reviewed teacher requests yet for this window."}
        </p>
      ) : (
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
                <th className="py-2 font-medium">{tab === "needs" ? "Actions" : "Decision"}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const window = windowInfo(row);
                return (
                  <tr key={row.id} className="border-b border-amber-100 align-top">
                    <td className="py-2 pr-4">
                      {changeRequestStudentLabel(row)}
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
                    <td className="max-w-xs py-2 pr-4">{examsLabel(row)}</td>
                    <td className="py-2 pr-4">{row.requestedBy.name}</td>
                    <td className="py-2 pr-4">{new Date(row.createdAt).toLocaleString()}</td>
                    <td className="py-2">
                      {tab === "reviewed" ? (
                        <div className="space-y-1">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              row.status === "APPROVED"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {row.status === "APPROVED" ? "Approved" : "Rejected"}
                          </span>
                          <p className="text-xs text-slate-500">
                            {row.reviewedBy?.name ? `${row.reviewedBy.name} · ` : ""}
                            {row.reviewedAt ? new Date(row.reviewedAt).toLocaleString() : "—"}
                          </p>
                          {row.reviewNote?.trim() ? (
                            <p className="whitespace-pre-wrap text-xs text-slate-700">
                              {row.reviewNote}
                            </p>
                          ) : null}
                          {row.registrationWorkspaceId ? (
                            <Link
                              href={`${detailBasePath}/${row.registrationWorkspaceId}`}
                              className="inline-block text-xs text-indigo-600 hover:underline"
                            >
                              Detail
                            </Link>
                          ) : null}
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={actingId === row.id}
                              onClick={() => void review(row.id, "APPROVED")}
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
                          <p className="text-xs text-slate-600">
                            <span className="font-medium">Reason:</span> {row.reason}
                          </p>
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
                                  onClick={() => void review(row.id, "REJECTED", rejectNote)}
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
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
