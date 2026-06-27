"use client";

import { useEffect, useMemo, useState } from "react";
import {
  EXAM_SESSION_PREVIEW_LIMIT,
  EXAM_SESSION_SEARCH_LIMIT,
  formatExamSessionOptionLabel,
  limitExamSessions,
  type ExamSessionSearchable,
} from "@/lib/exam-session-search";

export type ChangeRequestType = "ADD_EXAM" | "REMOVE_EXAM" | "REPLACE_EXAM";

export interface TeacherRegistrationRow {
  id: string;
  status: string;
  registrationWorkspaceId: string | null;
  studentNameSnapshot: string;
  studentNoSnapshot: string;
  gradeSnapshot: string;
  classNameSnapshot: string;
  examBoard: { id: string; name: string; code: string };
  examSeries: { id: string; name: string; year: number };
  subject: { id: string; name: string; code: string };
  paper: { code: string; title: string };
  examSession: { id: string; date: string; startTime: string | null };
}

interface ExamSessionOption extends ExamSessionSearchable {
  paper: ExamSessionSearchable["paper"] & { duration?: number | null };
}

function SessionPicker({
  sessions,
  loading,
  query,
  onQueryChange,
  selectedId,
  onSelect,
  placeholder,
}: {
  sessions: ExamSessionOption[];
  loading: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  selectedId: string;
  onSelect: (id: string) => void;
  placeholder: string;
}) {
  const { items: visibleSessions, truncated } = useMemo(
    () => limitExamSessions(sessions, query),
    [sessions, query],
  );
  const selectedSession = sessions.find((session) => session.id === selectedId) ?? null;
  const hasQuery = query.trim().length > 0;

  return (
    <div className="space-y-2">
      <input
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      {selectedSession ? (
        <p className="text-sm text-indigo-700">
          Selected: {formatExamSessionOptionLabel(selectedSession)}
        </p>
      ) : null}
      <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white">
        {loading ? (
          <p className="px-3 py-2 text-sm text-slate-500">Loading exam sessions...</p>
        ) : visibleSessions.length === 0 ? (
          <p className="px-3 py-2 text-sm text-slate-500">
            {hasQuery ? `No sessions match "${query.trim()}".` : "No exam sessions available."}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {visibleSessions.map((session) => (
              <li key={session.id}>
                <button
                  type="button"
                  onClick={() => onSelect(session.id)}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-indigo-50 ${
                    session.id === selectedId
                      ? "bg-indigo-50 font-medium text-indigo-800"
                      : "text-slate-800"
                  }`}
                >
                  {formatExamSessionOptionLabel(session)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {!loading && visibleSessions.length > 0 && truncated ? (
        <p className="text-xs text-slate-500">Refine your search to see more results.</p>
      ) : null}
    </div>
  );
}

function formatRegistrationLabel(row: TeacherRegistrationRow): string {
  const date = row.examSession.date.slice(0, 10);
  const time = row.examSession.startTime ? ` ${row.examSession.startTime}` : "";
  return `${row.paper.code} · ${row.paper.title} · ${date}${time}`;
}

interface TeacherChangeRequestModalProps {
  row: TeacherRegistrationRow;
  onClose: () => void;
  onSubmitted: () => void;
}

export function TeacherChangeRequestModal({
  row,
  onClose,
  onSubmitted,
}: TeacherChangeRequestModalProps) {
  const [requestType, setRequestType] = useState<ChangeRequestType>("REMOVE_EXAM");
  const [targetSessionId, setTargetSessionId] = useState(row.examSession.id);
  const [replacementSessionId, setReplacementSessionId] = useState("");
  const [targetQuery, setTargetQuery] = useState("");
  const [replacementQuery, setReplacementQuery] = useState("");
  const [sessions, setSessions] = useState<ExamSessionOption[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (requestType === "REMOVE_EXAM") {
      setTargetSessionId(row.examSession.id);
    }
  }, [requestType, row.examSession.id]);

  useEffect(() => {
    if (requestType === "ADD_EXAM") {
      setTargetSessionId("");
    }
    if (requestType !== "REPLACE_EXAM") {
      setReplacementSessionId("");
    }
  }, [requestType]);

  useEffect(() => {
    if (requestType !== "ADD_EXAM" && requestType !== "REPLACE_EXAM") return;

    const handle = window.setTimeout(() => {
      setSessionsLoading(true);
      const params = new URLSearchParams({ examSeriesId: row.examSeries.id });
      const q = (requestType === "ADD_EXAM" ? targetQuery : replacementQuery).trim();
      if (q) {
        params.set("q", q);
        params.set("limit", String(EXAM_SESSION_SEARCH_LIMIT));
      } else {
        params.set("limit", String(EXAM_SESSION_PREVIEW_LIMIT));
      }

      fetch(`/api/exam-sessions?${params.toString()}`)
        .then((r) => r.json())
        .then((data) => setSessions(Array.isArray(data) ? data : []))
        .catch(() => setSessions([]))
        .finally(() => setSessionsLoading(false));
    }, 250);

    return () => window.clearTimeout(handle);
  }, [requestType, row.examSeries.id, targetQuery, replacementQuery]);

  async function handleSubmit() {
    setError(null);

    if (!reason.trim()) {
      setError("Reason is required.");
      return;
    }
    if (!requestType) {
      setError("Request type is required.");
      return;
    }
    if (requestType === "ADD_EXAM" && !targetSessionId) {
      setError("Target exam is required.");
      return;
    }
    if (requestType === "REPLACE_EXAM" && !replacementSessionId) {
      setError("Replacement exam is required for Replace Exam.");
      return;
    }
    if (!row.registrationWorkspaceId) {
      setError("Registration workspace is missing for this row.");
      return;
    }

    const payload = {
      registrationWorkspaceId: row.registrationWorkspaceId,
      requestType,
      reason: reason.trim(),
      targetExamSessionId:
        requestType === "ADD_EXAM" ? targetSessionId : undefined,
      targetRegistrationId:
        requestType === "REMOVE_EXAM" || requestType === "REPLACE_EXAM" ? row.id : undefined,
      replacementExamSessionId:
        requestType === "REPLACE_EXAM" ? replacementSessionId : undefined,
    };

    setSubmitting(true);
    try {
      const response = await fetch("/api/teacher/change-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Could not submit change request");
      }
      onSubmitted();
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not submit change request");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div
        role="dialog"
        aria-labelledby="change-request-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
      >
        <h2 id="change-request-title" className="text-lg font-semibold text-slate-900">
          Request Registration Change
        </h2>

        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-slate-500">Student</dt>
            <dd className="font-medium text-slate-900">
              {row.studentNameSnapshot} ({row.studentNoSnapshot})
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Current Registration</dt>
            <dd className="font-medium text-slate-900">{formatRegistrationLabel(row)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Subject</dt>
            <dd className="font-medium text-slate-900">{row.subject.name}</dd>
          </div>
        </dl>

        <div className="mt-4 space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Request Type *</span>
            <select
              value={requestType}
              onChange={(e) => setRequestType(e.target.value as ChangeRequestType)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="ADD_EXAM">Add Exam</option>
              <option value="REMOVE_EXAM">Remove Exam</option>
              <option value="REPLACE_EXAM">Replace Exam</option>
            </select>
          </label>

          {requestType === "ADD_EXAM" ? (
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Target Exam *</span>
              <SessionPicker
                sessions={sessions}
                loading={sessionsLoading}
                query={targetQuery}
                onQueryChange={setTargetQuery}
                selectedId={targetSessionId}
                onSelect={setTargetSessionId}
                placeholder="Search exam to add..."
              />
            </label>
          ) : null}

          {requestType === "REMOVE_EXAM" ? (
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Target Exam *</span>
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-800">
                {formatRegistrationLabel(row)}
              </p>
            </label>
          ) : null}

          {requestType === "REPLACE_EXAM" ? (
            <>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Exam to Remove *</span>
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-800">
                  {formatRegistrationLabel(row)}
                </p>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Replacement Exam *</span>
                <SessionPicker
                  sessions={sessions}
                  loading={sessionsLoading}
                  query={replacementQuery}
                  onQueryChange={setReplacementQuery}
                  selectedId={replacementSessionId}
                  onSelect={setReplacementSessionId}
                  placeholder="Search replacement exam..."
                />
              </label>
            </>
          ) : null}

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Reason *</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Explain why this change is needed"
            />
          </label>
        </div>

        {error ? (
          <p className="mt-3 text-sm text-red-600">{error}</p>
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit to Exams Office"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function changeRequestTypeLabel(type: string): string {
  switch (type) {
    case "ADD_EXAM":
      return "Add Exam";
    case "REMOVE_EXAM":
      return "Remove Exam";
    case "REPLACE_EXAM":
      return "Replace Exam";
    case "LATE_REGISTRATION":
      return "Late Registration";
    default:
      return type;
  }
}

export function changeRequestStatusLabel(status: string): string {
  switch (status) {
    case "PENDING":
      return "Pending";
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Rejected";
    default:
      return status;
  }
}

export function formatExamSessionSummary(
  session: { date: string; startTime?: string | null; paper: { code: string; title?: string | null } } | null | undefined,
): string {
  if (!session) return "—";
  const date = session.date.slice(0, 10);
  const time = session.startTime ? ` ${session.startTime}` : "";
  return `${session.paper.code} · ${session.paper.title ?? ""} · ${date}${time}`;
}
