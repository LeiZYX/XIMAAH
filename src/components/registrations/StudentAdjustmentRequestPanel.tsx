"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  EXAM_SESSION_PREVIEW_LIMIT,
  EXAM_SESSION_SEARCH_LIMIT,
  type ExamSessionSearchable,
} from "@/lib/exam-session-search";
import type { StudentRegistrationRow } from "@/lib/registrations/student-groups";

export const STUDENT_ADJUSTMENT_WARNING = {
  title: "Student registration has closed.",
  body: (
    <>
      You can still request changes to exams that are already locked, but{" "}
      <strong>adding or removing exams after this point may incur extra fees</strong> (for example
      Late / High Late charges, or a lower refund if you withdraw).
      <br />
      <br />
      Please confirm you understand before continuing. Your request will need{" "}
      <strong>teacher approval</strong>, then <strong>Exams Office approval</strong>, before any
      change is applied.
    </>
  ),
} as const;

interface DraftRemove {
  registrationId: string;
  label: string;
  reason: string;
}

interface DraftAdd {
  examSessionId: string;
  label: string;
  reason: string;
}

interface PendingRequestSummary {
  id: string;
  status: "PENDING_TEACHER" | "PENDING_EO" | "APPROVED" | "REJECTED";
  registrationWorkspaceId: string;
}

interface SessionOption extends ExamSessionSearchable {
  examSeries?: { name: string; year: number };
}

function formatSessionLabel(session: SessionOption): string {
  const date =
    typeof session.date === "string" ? session.date.slice(0, 10) : session.date.toISOString().slice(0, 10);
  const time =
    session.startTime && session.endTime
      ? ` ${session.startTime}–${session.endTime}`
      : session.startTime
        ? ` ${session.startTime}`
        : "";
  const title = session.paper.title ? ` — ${session.paper.title}` : "";
  const series = session.examSeries
    ? ` · ${session.examSeries.name} (${session.examSeries.year})`
    : "";
  return `${session.paper.subject.name} · ${session.paper.code}${title} · ${date}${time}${series}`;
}

function examLabel(row: StudentRegistrationRow): string {
  const date = row.examSession.date.slice(0, 10);
  const time =
    row.examSession.startTime && row.examSession.endTime
      ? ` ${row.examSession.startTime}–${row.examSession.endTime}`
      : row.examSession.startTime
        ? ` ${row.examSession.startTime}`
        : "";
  return `${row.subject.name} · ${row.paper.code}${row.paper.title ? ` — ${row.paper.title}` : ""} · ${date}${time}`;
}

export function studentAdjustmentEligible(
  window: StudentRegistrationRow["registrationWindow"],
  now = new Date(),
): boolean {
  if (!window.studentAdjustmentRequestEnabled) return false;
  if (window.status !== "OPEN") return false;
  const studentClose = new Date(window.studentRegistrationCloseAt).getTime();
  const requestClose = new Date(
    window.studentAdjustmentRequestCloseAt ?? window.registrationCloseAt,
  ).getTime();
  const t = now.getTime();
  return t > studentClose && t <= requestClose;
}

export function pendingStatusLabel(status: string): string {
  switch (status) {
    case "PENDING_TEACHER":
      return "Pending teacher approval";
    case "PENDING_EO":
      return "Pending Exams Office approval";
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Rejected";
    default:
      return status;
  }
}

export function StudentAdjustmentRequestPanel({
  workspaceId,
  registrations,
  window: registrationWindow,
  onSubmitted,
}: {
  workspaceId: string;
  registrations: StudentRegistrationRow[];
  window: StudentRegistrationRow["registrationWindow"];
  onSubmitted: () => void;
}) {
  const eligible = studentAdjustmentEligible(registrationWindow);
  const [pending, setPending] = useState<PendingRequestSummary | null>(null);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [phase, setPhase] = useState<"idle" | "warning" | "draft">("idle");
  const [removes, setRemoves] = useState<DraftRemove[]>([]);
  const [adds, setAdds] = useState<DraftAdd[]>([]);
  const [removeReasonDraft, setRemoveReasonDraft] = useState<Record<string, string>>({});
  const [sessionQuery, setSessionQuery] = useState("");
  const [sessions, setSessions] = useState<SessionOption[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [addReason, setAddReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPending = useCallback(async () => {
    setPendingLoading(true);
    try {
      const res = await fetch("/api/student/adjustment-requests");
      const data = res.ok ? await res.json() : [];
      const rows = Array.isArray(data) ? (data as PendingRequestSummary[]) : [];
      const active =
        rows.find(
          (row) =>
            row.registrationWorkspaceId === workspaceId &&
            (row.status === "PENDING_TEACHER" || row.status === "PENDING_EO"),
        ) ?? null;
      setPending(active);
    } catch {
      setPending(null);
    } finally {
      setPendingLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void loadPending();
  }, [loadPending]);

  useEffect(() => {
    if (phase !== "draft") return;
    const handle = globalThis.setTimeout(() => {
      setSessionsLoading(true);
      const params = new URLSearchParams();
      const q = sessionQuery.trim();
      if (q) {
        params.set("q", q);
        params.set("limit", String(EXAM_SESSION_SEARCH_LIMIT));
      } else {
        params.set("limit", String(EXAM_SESSION_PREVIEW_LIMIT));
      }
      fetch(
        `/api/student/adjustment-requests/sessions/${workspaceId}?${params.toString()}`,
      )
        .then((r) => r.json())
        .then((data) => setSessions(Array.isArray(data) ? data : []))
        .catch(() => setSessions([]))
        .finally(() => setSessionsLoading(false));
    }, 250);
    return () => globalThis.clearTimeout(handle);
  }, [phase, sessionQuery, workspaceId]);

  const removeIds = useMemo(() => new Set(removes.map((row) => row.registrationId)), [removes]);
  const addIds = useMemo(() => new Set(adds.map((row) => row.examSessionId)), [adds]);
  const closeLabel = registrationWindow.studentAdjustmentRequestCloseAt
    ? new Date(registrationWindow.studentAdjustmentRequestCloseAt).toLocaleString()
    : new Date(registrationWindow.registrationCloseAt).toLocaleString();

  function startRemove(row: StudentRegistrationRow) {
    const reason = (removeReasonDraft[row.id] ?? "").trim();
    if (!reason) {
      setError("Enter a reason before removing an exam.");
      return;
    }
    setError(null);
    setRemoves((prev) => [
      ...prev.filter((item) => item.registrationId !== row.id),
      { registrationId: row.id, label: examLabel(row), reason },
    ]);
  }

  function addSelectedSession() {
    const session = sessions.find((row) => row.id === selectedSessionId);
    const reason = addReason.trim();
    if (!session) {
      setError("Select an exam to add.");
      return;
    }
    if (!reason) {
      setError("Enter a reason before adding an exam.");
      return;
    }
    setError(null);
    setAdds((prev) => [
      ...prev.filter((item) => item.examSessionId !== session.id),
      { examSessionId: session.id, label: formatSessionLabel(session), reason },
    ]);
    setSelectedSessionId("");
    setAddReason("");
  }

  async function submit() {
    if (removes.length + adds.length === 0) {
      setError("Add or remove at least one exam before submitting.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/student/adjustment-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registrationWorkspaceId: workspaceId,
          items: [
            ...removes.map((item) => ({
              itemType: "REMOVE",
              targetRegistrationId: item.registrationId,
              studentReason: item.reason,
            })),
            ...adds.map((item) => ({
              itemType: "ADD",
              targetExamSessionId: item.examSessionId,
              studentReason: item.reason,
            })),
          ],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Could not submit adjustment request");
      }
      setPhase("idle");
      setRemoves([]);
      setAdds([]);
      await loadPending();
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit adjustment request");
    } finally {
      setSubmitting(false);
    }
  }

  if (pendingLoading) return null;

  if (pending) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
        <p className="font-medium">{pendingStatusLabel(pending.status)}</p>
        <p className="mt-1 text-amber-900">
          Your adjustment request is waiting for review. You cannot submit another request for this
          registration until it is approved or rejected.
        </p>
      </div>
    );
  }

  if (!eligible) return null;

  if (phase === "warning") {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <p className="font-semibold">{STUDENT_ADJUSTMENT_WARNING.title}</p>
        <p className="mt-2 text-amber-900">{STUDENT_ADJUSTMENT_WARNING.body}</p>
        <p className="mt-2 text-xs text-amber-800">Request deadline: {closeLabel}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPhase("draft")}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            I understand — continue
          </button>
          <button
            type="button"
            onClick={() => setPhase("idle")}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (phase === "draft") {
    return (
      <div className="space-y-4 rounded-lg border border-indigo-200 bg-indigo-50/40 px-4 py-3 text-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-slate-900">Draft adjustment request</p>
            <p className="text-xs text-slate-600">Deadline: {closeLabel}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setPhase("idle");
              setError(null);
            }}
            className="text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            Cancel draft
          </button>
        </div>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700">
            {error}
          </div>
        ) : null}

        <div>
          <p className="mb-2 font-medium text-slate-800">Remove exams</p>
          <ul className="space-y-2">
            {registrations.map((row) => {
              if (removeIds.has(row.id)) return null;
              return (
                <li
                  key={row.id}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2"
                >
                  <p className="font-medium text-slate-900">{examLabel(row)}</p>
                  <textarea
                    value={removeReasonDraft[row.id] ?? ""}
                    onChange={(e) =>
                      setRemoveReasonDraft((prev) => ({ ...prev, [row.id]: e.target.value }))
                    }
                    placeholder="Reason for removal (required)"
                    rows={2}
                    className="mt-2 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => startRemove(row)}
                    className="mt-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          <p className="mb-2 font-medium text-slate-800">Add exam</p>
          <input
            value={sessionQuery}
            onChange={(e) => setSessionQuery(e.target.value)}
            placeholder="Search by subject, paper code, title, or date"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white">
            {sessionsLoading ? (
              <p className="px-3 py-2 text-slate-500">Loading…</p>
            ) : sessions.filter((s) => !addIds.has(s.id)).length === 0 ? (
              <p className="px-3 py-2 text-slate-500">No matching exams.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {sessions
                  .filter((s) => !addIds.has(s.id))
                  .map((session) => (
                    <li key={session.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedSessionId(session.id)}
                        className={`w-full px-3 py-2 text-left hover:bg-indigo-50 ${
                          selectedSessionId === session.id
                            ? "bg-indigo-50 font-medium text-indigo-800"
                            : "text-slate-800"
                        }`}
                      >
                        {formatSessionLabel(session)}
                      </button>
                    </li>
                  ))}
              </ul>
            )}
          </div>
          <textarea
            value={addReason}
            onChange={(e) => setAddReason(e.target.value)}
            placeholder="Reason for addition (required)"
            rows={2}
            className="mt-2 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={addSelectedSession}
            className="mt-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Add to request
          </button>
        </div>

        {(removes.length > 0 || adds.length > 0) && (
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
            <p className="font-medium text-slate-800">Summary</p>
            {removes.length > 0 ? (
              <ul className="mt-1 list-disc pl-5 text-slate-700">
                {removes.map((item) => (
                  <li key={item.registrationId}>
                    Remove: {item.label}
                    <button
                      type="button"
                      className="ml-2 text-xs text-indigo-600 hover:underline"
                      onClick={() =>
                        setRemoves((prev) =>
                          prev.filter((row) => row.registrationId !== item.registrationId),
                        )
                      }
                    >
                      Undo
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {adds.length > 0 ? (
              <ul className="mt-1 list-disc pl-5 text-slate-700">
                {adds.map((item) => (
                  <li key={item.examSessionId}>
                    Add: {item.label}
                    <button
                      type="button"
                      className="ml-2 text-xs text-indigo-600 hover:underline"
                      onClick={() =>
                        setAdds((prev) =>
                          prev.filter((row) => row.examSessionId !== item.examSessionId),
                        )
                      }
                    >
                      Undo
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}

        <button
          type="button"
          disabled={submitting}
          onClick={() => void submit()}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit changes"}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      title={`Request deadline: ${closeLabel}`}
      onClick={() => setPhase("warning")}
      className="rounded-lg border border-indigo-300 bg-white px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
    >
      Request adjustment
    </button>
  );
}
