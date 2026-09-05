"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { useRegistrationsRefresh } from "@/components/registrations/registrations-refresh";

interface AdjustmentItem {
  id: string;
  itemType: "ADD" | "REMOVE";
  studentReason: string;
  targetRegistrationId: string | null;
  targetExamSession: {
    date: string;
    startTime: string | null;
    endTime: string | null;
    paper: { code: string; title: string; subject: { name: string } };
    examSeries: { name: string; year: number };
  } | null;
}

interface AdjustmentRequestRow {
  id: string;
  status: string;
  submittedAt: string;
  teacherReviewReason: string | null;
  studentGradeSnapshot?: string | null;
  studentClassNameSnapshot?: string | null;
  primaryHomeroomTeacher?: { name: string } | null;
  student: {
    name: string;
    studentProfile: { studentNo: string } | null;
  };
  registrationWorkspace: {
    id: string;
    registrationWindow: {
      title: string;
      examBoard: { name: string };
      examSeries: { name: string; year: number };
    };
  };
  items: AdjustmentItem[];
}

function itemLabel(item: AdjustmentItem): string {
  const session = item.targetExamSession;
  if (!session) {
    return item.itemType === "REMOVE" ? `Remove registration ${item.targetRegistrationId}` : "Add exam";
  }
  const date = session.date.slice(0, 10);
  const time =
    session.startTime && session.endTime
      ? ` ${session.startTime}–${session.endTime}`
      : session.startTime
        ? ` ${session.startTime}`
        : "";
  return `${session.paper.subject.name} · ${session.paper.code}${
    session.paper.title ? ` — ${session.paper.title}` : ""
  } · ${date}${time} · ${session.examSeries.name}`;
}

export function PendingStudentAdjustmentRequests({
  apiPath,
  approveApiBase,
  status,
  title,
  description,
  detailBasePath,
}: {
  apiPath: string;
  approveApiBase: string;
  status: "PENDING_TEACHER" | "PENDING_EO";
  title: string;
  description: string;
  detailBasePath?: string;
}) {
  const [rows, setRows] = useState<AdjustmentRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [reasonById, setReasonById] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [feeNotice, setFeeNotice] = useState<string | null>(null);
  const { bumpWorkspaceList, registrationWindowId } = useRegistrationsRefresh();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status });
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
  }, [apiPath, registrationWindowId, status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function review(requestId: string, decision: "APPROVED" | "REJECTED") {
    const reviewReason = (reasonById[requestId] ?? "").trim();
    if (!reviewReason) {
      setError("A review reason is required.");
      return;
    }
    setActingId(requestId);
    setError(null);
    setFeeNotice(null);
    try {
      const path =
        decision === "APPROVED"
          ? `${approveApiBase}/${requestId}/approve`
          : `${approveApiBase}/${requestId}/reject`;
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewReason }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Could not review request");
      }
      if (decision === "APPROVED" && data.feeNeedsRegeneration && detailBasePath && data.registrationWorkspaceId) {
        setFeeNotice(
          `Adjustment applied. Fee statement needs regeneration — open the registration and use Regenerate Revised Statement.`,
        );
      } else if (decision === "APPROVED" && data.feeNeedsRegeneration) {
        setFeeNotice(
          "Adjustment applied. Fee statement needs regeneration — use Regenerate Revised Statement on the registration.",
        );
      }
      setReasonById((prev) => {
        const next = { ...prev };
        delete next[requestId];
        return next;
      });
      await load();
      bumpWorkspaceList();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Could not review request");
    } finally {
      setActingId(null);
    }
  }

  if (loading) return null;
  if (rows.length === 0 && !feeNotice) return null;

  return (
    <Card className="border-amber-200 bg-amber-50/50">
      <h2 className="mb-1 text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mb-3 text-sm text-slate-600">{description}</p>
      {feeNotice ? (
        <div className="mb-3 rounded-lg border border-amber-300 bg-amber-100 px-3 py-2 text-sm text-amber-950">
          {feeNotice}
        </div>
      ) : null}
      {error ? (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      <div className="space-y-4">
        {rows.map((row) => {
          const windowInfo = row.registrationWorkspace.registrationWindow;
          return (
            <div
              key={row.id}
              className="rounded-lg border border-amber-200 bg-white px-4 py-3 text-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-900">
                    {row.student.name}
                    {row.student.studentProfile?.studentNo
                      ? ` · ${row.student.studentProfile.studentNo}`
                      : ""}
                  </p>
                  <p className="text-slate-600">
                    {windowInfo.examBoard.name} · {windowInfo.title} · {windowInfo.examSeries.name} (
                    {windowInfo.examSeries.year})
                  </p>
                  {row.studentGradeSnapshot || row.studentClassNameSnapshot ? (
                    <p className="text-slate-600">
                      Class: {row.studentGradeSnapshot?.replace(/^G/, "G") ?? "—"}{" "}
                      {row.studentClassNameSnapshot ?? ""}
                      {row.primaryHomeroomTeacher
                        ? ` · Form teacher: ${row.primaryHomeroomTeacher.name}`
                        : ""}
                    </p>
                  ) : null}
                  <p className="text-xs text-slate-500">
                    Submitted {new Date(row.submittedAt).toLocaleString()}
                  </p>
                  {detailBasePath ? (
                    <p className="mt-1">
                      <Link
                        href={`${detailBasePath}/${row.registrationWorkspace.id}`}
                        className="text-indigo-600 hover:underline"
                      >
                        Open registration
                      </Link>
                    </p>
                  ) : null}
                </div>
              </div>
              <ul className="mt-3 space-y-2">
                {row.items.map((item) => (
                  <li key={item.id} className="rounded border border-slate-100 bg-slate-50 px-3 py-2">
                    <p className="font-medium text-slate-800">
                      {item.itemType === "ADD" ? "Add" : "Remove"}: {itemLabel(item)}
                    </p>
                    <p className="mt-1 text-slate-600">
                      <span className="font-medium">Student reason:</span> {item.studentReason}
                    </p>
                  </li>
                ))}
              </ul>
              {row.teacherReviewReason ? (
                <p className="mt-2 text-slate-600">
                  <span className="font-medium">Teacher reason:</span> {row.teacherReviewReason}
                </p>
              ) : null}
              <label className="mt-3 block">
                <span className="mb-1 block text-slate-700">Your review reason (required)</span>
                <textarea
                  value={reasonById[row.id] ?? ""}
                  onChange={(e) =>
                    setReasonById((prev) => ({ ...prev, [row.id]: e.target.value }))
                  }
                  rows={2}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Enter approval or rejection reason"
                />
              </label>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={actingId === row.id}
                  onClick={() => void review(row.id, "APPROVED")}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={actingId === row.id}
                  onClick={() => void review(row.id, "REJECTED")}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
