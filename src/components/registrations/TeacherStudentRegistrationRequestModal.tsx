"use client";

import { useEffect, useMemo, useState } from "react";
import {
  EXAM_SESSION_PREVIEW_LIMIT,
  EXAM_SESSION_SEARCH_LIMIT,
  formatExamSessionOptionLabel,
  limitExamSessions,
  type ExamSessionSearchable,
} from "@/lib/exam-session-search";
import type {
  TeacherStudentDetail,
  TeacherStudentExamRow,
  TeacherStudentSummary,
} from "@/lib/registrations/teacher-student-list";

interface ExamSessionOption extends ExamSessionSearchable {
  id: string;
}

interface TeacherStudentRegistrationRequestModalProps {
  summary: TeacherStudentSummary;
  detail: TeacherStudentDetail;
  onClose: () => void;
  onSubmitted: (count: number) => void;
}

function formatExamLabel(exam: TeacherStudentExamRow): string {
  const date = exam.examSession.date.slice(0, 10);
  const time = exam.examSession.startTime ? ` ${exam.examSession.startTime}` : "";
  return `${exam.subject.name} · ${exam.paper.code} · ${exam.paper.title} · ${date}${time}`;
}

export function TeacherStudentRegistrationRequestModal({
  summary,
  detail,
  onClose,
  onSubmitted,
}: TeacherStudentRegistrationRequestModalProps) {
  const [removalIds, setRemovalIds] = useState<Set<string>>(new Set());
  const [addSessionIds, setAddSessionIds] = useState<string[]>([]);
  const [addQuery, setAddQuery] = useState("");
  const [addSessions, setAddSessions] = useState<ExamSessionOption[]>([]);
  const [addSessionsLoading, setAddSessionsLoading] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const primaryExam = detail.exams[0] ?? null;
  const primaryWorkspaceId =
    detail.exams.find((exam) => exam.registrationWorkspaceId)?.registrationWorkspaceId ?? null;

  const blockedSessionIds = useMemo(
    () => new Set(detail.exams.map((exam) => exam.examSession.id)),
    [detail.exams],
  );

  useEffect(() => {
    setAddSessionIds((current) => current.filter((id) => !blockedSessionIds.has(id)));
  }, [blockedSessionIds]);

  useEffect(() => {
    if (!primaryExam) return;

    const handle = window.setTimeout(() => {
      setAddSessionsLoading(true);
      const params = new URLSearchParams({ examSeriesId: primaryExam.examSeries.id });
      const q = addQuery.trim();
      if (q) {
        params.set("q", q);
        params.set("limit", String(EXAM_SESSION_SEARCH_LIMIT));
      } else {
        params.set("limit", String(EXAM_SESSION_PREVIEW_LIMIT));
      }

      fetch(`/api/exam-sessions?${params.toString()}`)
        .then((r) => r.json())
        .then((data) => setAddSessions(Array.isArray(data) ? data : []))
        .catch(() => setAddSessions([]))
        .finally(() => setAddSessionsLoading(false));
    }, 250);

    return () => window.clearTimeout(handle);
  }, [primaryExam, addQuery]);

  const visibleAddSessions = useMemo(
    () =>
      limitExamSessions(addSessions, addQuery).items.filter(
        (session) => !blockedSessionIds.has(session.id),
      ),
    [addSessions, addQuery, blockedSessionIds],
  );

  const pendingChangeCount = removalIds.size + addSessionIds.length;

  function toggleRemoval(examId: string) {
    setRemovalIds((current) => {
      const next = new Set(current);
      if (next.has(examId)) {
        next.delete(examId);
      } else {
        next.add(examId);
      }
      return next;
    });
  }

  function toggleAddSession(sessionId: string) {
    setAddSessionIds((current) =>
      current.includes(sessionId)
        ? current.filter((id) => id !== sessionId)
        : [...current, sessionId],
    );
  }

  async function handleSubmit() {
    setError(null);

    if (!reason.trim()) {
      setError("Reason is required.");
      return;
    }
    if (pendingChangeCount === 0) {
      setError("Select at least one add or remove change.");
      return;
    }
    if (!primaryWorkspaceId) {
      setError("No registration workspace is available for this student.");
      return;
    }

    const payloads: Array<Record<string, string | undefined>> = [];

    for (const examId of removalIds) {
      const exam = detail.exams.find((row) => row.id === examId);
      if (!exam?.registrationWorkspaceId) continue;
      payloads.push({
        registrationWorkspaceId: exam.registrationWorkspaceId,
        requestType: "REMOVE_EXAM",
        targetRegistrationId: examId,
        reason: reason.trim(),
      });
    }

    for (const sessionId of addSessionIds) {
      payloads.push({
        registrationWorkspaceId: primaryWorkspaceId,
        requestType: "ADD_EXAM",
        targetExamSessionId: sessionId,
        reason: reason.trim(),
      });
    }

    setSubmitting(true);
    try {
      for (const payload of payloads) {
        const response = await fetch("/api/teacher/change-requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || "Could not submit change request");
        }
      }
      onSubmitted(payloads.length);
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not submit changes");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">Request Late Registration</h2>
        <p className="mt-1 text-sm text-slate-600">
          Review this student&apos;s registrations and request adds or removals for the Exams Office to
          review.
        </p>

        <dl className="mt-4 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Student</dt>
            <dd className="font-medium text-slate-900">{summary.studentName}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Student number</dt>
            <dd className="font-medium text-slate-900">{summary.studentNo}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Candidate number</dt>
            <dd className="font-medium text-slate-900">{summary.candidateNumber}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Grade / Class</dt>
            <dd className="font-medium text-slate-900">
              {summary.grade} · {summary.className}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Exam board(s)</dt>
            <dd className="font-medium text-slate-900">{summary.examBoards}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Exam series</dt>
            <dd className="font-medium text-slate-900">{summary.examSeries}</dd>
          </div>
        </dl>

        <div className="mt-4">
          <h3 className="text-sm font-semibold text-slate-900">Current registrations</h3>
          <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-xs uppercase text-slate-500">
                  <th className="px-3 py-2">Exam</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {detail.exams.map((exam) => {
                  const canChange = exam.status === "LOCKED" && exam.registrationWorkspaceId;
                  const markedRemove = removalIds.has(exam.id);

                  return (
                    <tr key={exam.id} className="border-b border-slate-100 align-top">
                      <td className="px-3 py-2">
                        <p className="font-medium text-slate-900">{formatExamLabel(exam)}</p>
                        {markedRemove ? (
                          <p className="mt-1 text-xs text-red-700">Marked for removal</p>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        {exam.status === "LOCKED" ? (
                          <span className="font-medium text-indigo-700">Locked</span>
                        ) : (
                          <span className="text-amber-700">Active</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {canChange ? (
                          <button
                            type="button"
                            onClick={() => toggleRemoval(exam.id)}
                            className={`rounded-lg border px-2 py-1 text-xs font-medium ${
                              markedRemove
                                ? "border-red-300 bg-red-50 text-red-700"
                                : "border-slate-300 text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            {markedRemove ? "Undo remove" : "Remove"}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">Awaiting lock</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-900">Add exams</h3>
          <p className="mt-1 text-xs text-slate-500">
            Already registered exams are not shown here, including those marked for removal.
          </p>
          <input
            value={addQuery}
            onChange={(e) => setAddQuery(e.target.value)}
            placeholder="Search exams to add..."
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-slate-200">
            {addSessionsLoading ? (
              <p className="px-3 py-2 text-sm text-slate-500">Loading exam sessions...</p>
            ) : visibleAddSessions.length === 0 ? (
              <p className="px-3 py-2 text-sm text-slate-500">
                {addQuery.trim()
                  ? `No additional exams match "${addQuery.trim()}".`
                  : "No additional exams available. The student is already registered for all listed sessions."}
              </p>
            ) : (
              visibleAddSessions.map((session) => (
                <label
                  key={session.id}
                  className="flex cursor-pointer items-start gap-2 border-b border-slate-100 px-3 py-2 text-sm hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={addSessionIds.includes(session.id)}
                    onChange={() => toggleAddSession(session.id)}
                    className="mt-1"
                  />
                  <span>{formatExamSessionOptionLabel(session)}</span>
                </label>
              ))
            )}
          </div>
          {addSessionIds.length > 0 ? (
            <p className="mt-1 text-xs text-slate-500">{addSessionIds.length} exam(s) to add</p>
          ) : null}
        </div>

        <label className="mt-4 block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Reason *</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Explain why these registration changes are needed"
          />
        </label>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            {pendingChangeCount} change{pendingChangeCount === 1 ? "" : "s"} selected
          </p>
          <div className="flex gap-2">
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
    </div>
  );
}
