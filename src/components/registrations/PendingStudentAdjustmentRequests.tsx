"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { useRegistrationsRefresh } from "@/components/registrations/registrations-refresh";
import { formatEnglishWithChineseName } from "@/lib/candidates/identity";

type ReviewTab = "needs" | "reviewed";

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
  teacherReviewedAt?: string | null;
  eoReviewReason?: string | null;
  eoReviewedAt?: string | null;
  rejectedAtStage?: string | null;
  studentGradeSnapshot?: string | null;
  studentClassNameSnapshot?: string | null;
  primaryHomeroomTeacher?: { name: string } | null;
  teacherReviewedBy?: { name: string } | null;
  eoReviewedBy?: { name: string } | null;
  student: {
    name: string;
    studentProfile: { studentNo: string } | null;
    candidate?: { chineseName?: string | null; englishName?: string | null } | null;
  };
  candidate?: { chineseName?: string | null; englishName?: string | null } | null;
  registrationWorkspace: {
    id: string;
    candidate?: { chineseName?: string | null; englishName?: string | null } | null;
    student?: {
      candidate?: { chineseName?: string | null; englishName?: string | null } | null;
    } | null;
    registrationWindow: {
      title: string;
      examBoard: { name: string };
      examSeries: { name: string; year: number };
    };
  };
  items: AdjustmentItem[];
}

function requestStudentLabel(row: AdjustmentRequestRow): string {
  const chinese =
    row.candidate?.chineseName ||
    row.student.candidate?.chineseName ||
    row.registrationWorkspace.candidate?.chineseName ||
    row.registrationWorkspace.student?.candidate?.chineseName ||
    null;
  const english =
    row.candidate?.englishName ||
    row.student.candidate?.englishName ||
    row.student.name ||
    "";
  return formatEnglishWithChineseName(english, chinese);
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

function statusBadge(row: AdjustmentRequestRow, role: "TEACHER" | "EO") {
  if (row.status === "APPROVED") {
    return {
      label: "Approved",
      className: "bg-emerald-100 text-emerald-800",
    };
  }
  if (row.status === "REJECTED") {
    const stage =
      row.rejectedAtStage === "TEACHER"
        ? "by teacher"
        : row.rejectedAtStage === "EO"
          ? "by Exams Office"
          : "";
    return {
      label: stage ? `Rejected ${stage}` : "Rejected",
      className: "bg-rose-100 text-rose-800",
    };
  }
  if (role === "TEACHER" && row.status === "PENDING_EO") {
    return {
      label: "Awaiting Exams Office",
      className: "bg-amber-100 text-amber-900",
    };
  }
  if (row.status === "PENDING_TEACHER") {
    return {
      label: "Awaiting teacher",
      className: "bg-slate-100 text-slate-700",
    };
  }
  if (row.status === "PENDING_EO") {
    return {
      label: "Awaiting Exams Office",
      className: "bg-amber-100 text-amber-900",
    };
  }
  return {
    label: row.status,
    className: "bg-slate-100 text-slate-700",
  };
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
  const role = status === "PENDING_TEACHER" ? "TEACHER" : "EO";
  const [tab, setTab] = useState<ReviewTab>("needs");
  const [needsRows, setNeedsRows] = useState<AdjustmentRequestRow[]>([]);
  const [reviewedRows, setReviewedRows] = useState<AdjustmentRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [reasonById, setReasonById] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [feeNotice, setFeeNotice] = useState<string | null>(null);
  const { bumpWorkspaceList, registrationWindowId } = useRegistrationsRefresh();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const shared = new URLSearchParams();
      if (registrationWindowId) {
        shared.set("registrationWindowId", registrationWindowId);
      }

      const needsParams = new URLSearchParams(shared);
      needsParams.set("status", status);

      const reviewedParams = new URLSearchParams(shared);
      if (role === "TEACHER") {
        reviewedParams.set("reviewedByTeacher", "true");
      } else {
        reviewedParams.set("status", "APPROVED,REJECTED");
      }
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
  }, [apiPath, registrationWindowId, role, status]);

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
      setTab("reviewed");
      await load();
      bumpWorkspaceList();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Could not review request");
    } finally {
      setActingId(null);
    }
  }

  const rows = tab === "needs" ? needsRows : reviewedRows;

  return (
    <Card className="border-amber-200 bg-amber-50/50">
      <h2 className="mb-1 text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mb-3 text-sm text-slate-600">{description}</p>
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
      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500">
          {tab === "needs"
            ? "No requests waiting for your review."
            : "No reviewed requests yet for this window."}
        </p>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => {
            const windowInfo = row.registrationWorkspace.registrationWindow;
            const badge = statusBadge(row, role);
            return (
              <div
                key={row.id}
                className="rounded-lg border border-amber-200 bg-white px-4 py-3 text-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-900">
                      {requestStudentLabel(row)}
                      {row.student.studentProfile?.studentNo
                        ? ` · ${row.student.studentProfile.studentNo}`
                        : ""}
                    </p>
                    <p className="text-slate-600">
                      {windowInfo.examBoard.name} · {windowInfo.title} · {windowInfo.examSeries.name}{" "}
                      ({windowInfo.examSeries.year})
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
                  {tab === "reviewed" ? (
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  ) : null}
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

                {tab === "reviewed" || row.teacherReviewReason ? (
                  <div className="mt-3 space-y-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-slate-700">
                    {row.teacherReviewedAt || row.teacherReviewReason ? (
                      <div>
                        <p className="font-medium text-slate-800">
                          Teacher{" "}
                          {row.status === "REJECTED" && row.rejectedAtStage === "TEACHER"
                            ? "rejected"
                            : "approved"}
                          {row.teacherReviewedBy?.name ? ` · ${row.teacherReviewedBy.name}` : ""}
                        </p>
                        {row.teacherReviewedAt ? (
                          <p className="text-xs text-slate-500">
                            {new Date(row.teacherReviewedAt).toLocaleString()}
                          </p>
                        ) : null}
                        <p className="mt-1 whitespace-pre-wrap">
                          {row.teacherReviewReason?.trim() || "—"}
                        </p>
                      </div>
                    ) : null}
                    {row.eoReviewedAt || row.eoReviewReason ? (
                      <div>
                        <p className="font-medium text-slate-800">
                          Exams Office{" "}
                          {row.status === "REJECTED" && row.rejectedAtStage === "EO"
                            ? "rejected"
                            : row.status === "APPROVED"
                              ? "approved"
                              : "reviewed"}
                          {row.eoReviewedBy?.name ? ` · ${row.eoReviewedBy.name}` : ""}
                        </p>
                        {row.eoReviewedAt ? (
                          <p className="text-xs text-slate-500">
                            {new Date(row.eoReviewedAt).toLocaleString()}
                          </p>
                        ) : null}
                        <p className="mt-1 whitespace-pre-wrap">
                          {row.eoReviewReason?.trim() || "—"}
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {tab === "needs" ? (
                  <>
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
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
