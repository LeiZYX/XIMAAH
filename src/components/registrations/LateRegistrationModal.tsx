"use client";

import { useEffect, useMemo, useState } from "react";
import {
  RegistrationWindowSelectorFields,
  useRegistrationWindowSelector,
} from "@/components/registrations/RegistrationWindowSelector";
import { RegistrationExamBoardIdentitySection } from "@/components/registrations/RegistrationExamBoardIdentitySection";
import {
  EXAM_SESSION_PREVIEW_LIMIT,
  EXAM_SESSION_SEARCH_LIMIT,
  formatExamSessionOptionLabel,
  limitExamSessions,
  type ExamSessionSearchable,
} from "@/lib/exam-session-search";

interface StudentOption {
  id: string;
  name: string;
  studentNo: string | null;
  email: string | null;
  grade: string | null;
  className: string | null;
  candidateId: string | null;
}

interface ExamSessionOption extends ExamSessionSearchable {
  id: string;
}

interface ExistingExamRow {
  id: string;
  status: string;
  registrationWorkspaceId: string | null;
  subject: { name: string };
  paper: { code: string; title: string };
  examSession: { id: string; date: string; startTime: string | null };
}

function formatExistingExamLabel(exam: ExistingExamRow): string {
  const date = exam.examSession.date.slice(0, 10);
  const time = exam.examSession.startTime ? ` ${exam.examSession.startTime}` : "";
  return `${exam.subject.name} · ${exam.paper.code} · ${exam.paper.title} · ${date}${time}`;
}

interface LateRegistrationModalProps {
  title: string;
  submitLabel: string;
  apiPath: string;
  /** Teacher requests: OPEN windows only. Staff help: OPEN or CLOSED. */
  windowFilter?: "teacher" | "staff";
  candidateDetailBasePath?: string;
  onClose: () => void;
  onSubmitted: (result: { workspaceId?: string }) => void;
}

export function LateRegistrationModal({
  title,
  submitLabel,
  apiPath,
  windowFilter = "staff",
  candidateDetailBasePath,
  onClose,
  onSubmitted,
}: LateRegistrationModalProps) {
  const [studentQuery, setStudentQuery] = useState("");
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentOption | null>(null);
  const windowSelector = useRegistrationWindowSelector({
    scope: windowFilter === "teacher" ? "late-teacher" : "late-staff",
  });
  const registrationWindowId = windowSelector.registrationWindowId;
  const selectedWindow = windowSelector.selectedWindow as {
    id: string;
    status?: string;
    examSeries: { id: string; name: string; year: number };
    examBoard: { id: string; name: string };
  } | null;
  const [subjectFilter, setSubjectFilter] = useState("");
  const [sessionQuery, setSessionQuery] = useState("");
  const [sessions, setSessions] = useState<ExamSessionOption[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [addSessionIds, setAddSessionIds] = useState<string[]>([]);
  const [removalIds, setRemovalIds] = useState<Set<string>>(new Set());
  const [existingExams, setExistingExams] = useState<ExistingExamRow[]>([]);
  const [existingExamsLoading, setExistingExamsLoading] = useState(false);
  const [reason, setReason] = useState("");
  const [entryTypeOverride, setEntryTypeOverride] = useState<"" | "NORMAL" | "LATE" | "HIGH_LATE">(
    "",
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isStaffFlow = windowFilter === "staff";
  const isTeacherFlow = windowFilter === "teacher";
  const windowStatus = String(selectedWindow?.status ?? "");
  const requiresFeeStageChoice =
    isStaffFlow && (windowStatus === "CLOSED" || windowStatus === "ARCHIVED");

  const blockedSessionIds = useMemo(
    () => new Set(existingExams.map((exam) => exam.examSession.id)),
    [existingExams],
  );

  const pendingChangeCount = removalIds.size + (isTeacherFlow ? addSessionIds.length : selectedSessionIds.length);

  useEffect(() => {
    if (studentQuery.trim().length < 2) {
      setStudents([]);
      return;
    }
    const handle = window.setTimeout(() => {
      setStudentsLoading(true);
      fetch(`/api/students/search?q=${encodeURIComponent(studentQuery.trim())}`)
        .then((r) => r.json())
        .then((data) => setStudents(Array.isArray(data) ? data : []))
        .catch(() => setStudents([]))
        .finally(() => setStudentsLoading(false));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [studentQuery]);

  useEffect(() => {
    if (!isTeacherFlow || !selectedStudent || !registrationWindowId) {
      setExistingExams([]);
      setRemovalIds(new Set());
      return;
    }

    let cancelled = false;
    setExistingExamsLoading(true);
    const params = new URLSearchParams({
      studentKey: `user:${selectedStudent.id}`,
      registrationWindowId,
    });

    fetch(`/api/teacher/registrations/students?${params.toString()}`)
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        const exams = Array.isArray(data?.exams) ? data.exams : [];
        setExistingExams(exams);
        setRemovalIds(new Set());
        const blocked = new Set(exams.map((exam: ExistingExamRow) => exam.examSession.id));
        setAddSessionIds((current) => current.filter((sessionId) => !blocked.has(sessionId)));
      })
      .catch(() => {
        if (cancelled) return;
        setExistingExams([]);
      })
      .finally(() => {
        if (!cancelled) setExistingExamsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isTeacherFlow, selectedStudent, registrationWindowId]);

  useEffect(() => {
    if (!selectedWindow) {
      setSessions([]);
      return;
    }
    const handle = window.setTimeout(() => {
      setSessionsLoading(true);
      const params = new URLSearchParams({ examSeriesId: selectedWindow.examSeries.id });
      const q = sessionQuery.trim();
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
  }, [selectedWindow, sessionQuery]);

  const visibleSessions = useMemo(() => {
    const { items } = limitExamSessions(sessions, sessionQuery);
    const filtered = subjectFilter.trim()
      ? items.filter((session) =>
          session.paper.subject.name.toLowerCase().includes(subjectFilter.trim().toLowerCase()),
        )
      : items;
    if (!isTeacherFlow) return filtered;
    return filtered.filter((session) => !blockedSessionIds.has(session.id));
  }, [sessions, sessionQuery, subjectFilter, isTeacherFlow, blockedSessionIds]);

  function toggleSession(id: string) {
    setSelectedSessionIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }

  function toggleAddSession(id: string) {
    setAddSessionIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }

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

  async function handleSubmit() {
    setError(null);
    if (!selectedStudent) {
      setError("Please select a student.");
      return;
    }
    if (!registrationWindowId) {
      setError("Please select a registration window.");
      return;
    }
    if (isTeacherFlow) {
      if (pendingChangeCount === 0) {
        setError("Select at least one exam to add or remove.");
        return;
      }
    } else if (selectedSessionIds.length === 0) {
      setError("Please select at least one exam session.");
      return;
    }
    if (!reason.trim()) {
      setError("Reason is required.");
      return;
    }
    if (requiresFeeStageChoice && !entryTypeOverride) {
      setError("Select which fee stage to charge (Normal, Late, or High Late).");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isTeacherFlow
            ? {
                studentId: selectedStudent.id,
                registrationWindowId,
                examSessionIds: addSessionIds,
                removeRegistrationIds: [...removalIds],
                reason: reason.trim(),
              }
            : {
                studentId: selectedStudent.id,
                registrationWindowId,
                examSessionIds: selectedSessionIds,
                reason: reason.trim(),
                ...(entryTypeOverride ? { entryTypeOverride } : {}),
              },
        ),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Could not submit late registration");
      }
      onSubmitted({ workspaceId: data.id });
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not submit");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-600">
          {windowFilter === "teacher"
            ? "Submit a request to the Exams Office. Adjustments require EO or Admin approval while the registration window is open."
            : "Add exams for a student after the self-registration deadline. Open windows use assisted registration; closed windows use post-lock adjustment."}
        </p>

        <div className="mt-4 space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Student search *</span>
            <input
              value={studentQuery}
              onChange={(e) => setStudentQuery(e.target.value)}
              placeholder="Name, student number, or email"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            {selectedStudent ? (
              <p className="mt-2 text-sm text-indigo-700">
                Selected: {selectedStudent.name}
                {selectedStudent.studentNo ? ` (${selectedStudent.studentNo})` : ""}
                {selectedStudent.grade ? ` · ${selectedStudent.grade}` : ""}
                {selectedStudent.className ? ` ${selectedStudent.className}` : ""}
              </p>
            ) : null}
            <div className="mt-2 max-h-36 overflow-y-auto rounded-lg border border-slate-200">
              {studentsLoading ? (
                <p className="px-3 py-2 text-sm text-slate-500">Searching...</p>
              ) : students.length === 0 ? (
                <p className="px-3 py-2 text-sm text-slate-500">
                  {studentQuery.trim().length >= 2 ? "No students found." : "Type at least 2 characters."}
                </p>
              ) : (
                students.map((student) => (
                  <button
                    key={student.id}
                    type="button"
                    onClick={() => setSelectedStudent(student)}
                    className={`block w-full px-3 py-2 text-left text-sm hover:bg-indigo-50 ${
                      selectedStudent?.id === student.id ? "bg-indigo-50 font-medium text-indigo-800" : ""
                    }`}
                  >
                    {student.name}
                    {student.studentNo ? ` · ${student.studentNo}` : ""}
                    {student.email ? ` · ${student.email}` : ""}
                  </button>
                ))
              )}
            </div>
          </label>

          <RegistrationWindowSelectorFields
            state={{
              ...windowSelector,
              setRegistrationWindowId: (id) => {
                windowSelector.setRegistrationWindowId(id);
                setSelectedSessionIds([]);
                setAddSessionIds([]);
                setRemovalIds(new Set());
                setEntryTypeOverride("");
              },
            }}
          />

          {isStaffFlow && selectedWindow ? (
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">
                Fee entry stage{requiresFeeStageChoice ? " *" : ""}
              </span>
              <select
                value={entryTypeOverride}
                onChange={(e) =>
                  setEntryTypeOverride(e.target.value as "" | "NORMAL" | "LATE" | "HIGH_LATE")
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">
                  {requiresFeeStageChoice
                    ? "Select fee stage…"
                    : "Automatic (current fee stage)"}
                </option>
                <option value="NORMAL">Normal Entry</option>
                <option value="LATE">Late Entry</option>
                <option value="HIGH_LATE">High Late Entry</option>
              </select>
              <p className="mt-1 text-xs text-slate-500">
                {requiresFeeStageChoice
                  ? "This registration window is closed and fee stages are no longer timed. Choose which fee rule to apply to the added exams."
                  : "Leave automatic unless you need to force a specific fee stage."}
              </p>
            </label>
          ) : null}

          {isStaffFlow && candidateDetailBasePath ? (
            <RegistrationExamBoardIdentitySection
              candidateId={selectedStudent?.candidateId ?? null}
              examBoardId={selectedWindow?.examBoard.id ?? null}
              examBoardName={selectedWindow?.examBoard.name ?? null}
              candidateDetailBasePath={candidateDetailBasePath}
            />
          ) : null}

          {selectedWindow && !isStaffFlow ? (
            <p className="text-sm text-slate-600">
              Exam Board: <span className="font-medium">{selectedWindow.examBoard.name}</span>
            </p>
          ) : isStaffFlow && selectedWindow ? (
            <p className="text-sm text-slate-600">
              Exam Board: <span className="font-medium">{selectedWindow.examBoard.name}</span>
            </p>
          ) : null}

          {isTeacherFlow && selectedStudent && registrationWindowId ? (
            <div className="rounded-lg border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-900">Current registrations</h3>
              <p className="mt-1 text-xs text-slate-500">
                Mark exams to remove. All changes require Exams Office approval.
              </p>
              {existingExamsLoading ? (
                <p className="mt-2 text-sm text-slate-500">Loading current registrations...</p>
              ) : existingExams.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">No existing registrations in this window.</p>
              ) : (
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
                      {existingExams.map((exam) => {
                        const canRemove = exam.status === "LOCKED" && exam.registrationWorkspaceId;
                        const markedRemove = removalIds.has(exam.id);
                        return (
                          <tr key={exam.id} className="border-b border-slate-100 align-top">
                            <td className="px-3 py-2">
                              <p className="font-medium text-slate-900">{formatExistingExamLabel(exam)}</p>
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
                              {canRemove ? (
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
              )}
            </div>
          ) : null}

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Subject filter</span>
            <input
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              placeholder="Filter by subject name"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">
              {isTeacherFlow ? "Add exams" : "Exam sessions *"}
            </span>
            <input
              value={sessionQuery}
              onChange={(e) => setSessionQuery(e.target.value)}
              placeholder="Search by subject, paper code, or title"
              className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200">
              {sessionsLoading ? (
                <p className="px-3 py-2 text-sm text-slate-500">Loading exam sessions...</p>
              ) : visibleSessions.length === 0 ? (
                <p className="px-3 py-2 text-sm text-slate-500">
                  {isTeacherFlow
                    ? "No additional exam sessions available."
                    : "No exam sessions available."}
                </p>
              ) : (
                visibleSessions.map((session) => (
                  <label
                    key={session.id}
                    className="flex cursor-pointer items-start gap-2 border-b border-slate-100 px-3 py-2 text-sm hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={
                        isTeacherFlow
                          ? addSessionIds.includes(session.id)
                          : selectedSessionIds.includes(session.id)
                      }
                      onChange={() =>
                        isTeacherFlow ? toggleAddSession(session.id) : toggleSession(session.id)
                      }
                      className="mt-1"
                    />
                    <span>{formatExamSessionOptionLabel(session)}</span>
                  </label>
                ))
              )}
            </div>
            {isTeacherFlow && addSessionIds.length > 0 ? (
              <p className="mt-1 text-xs text-slate-500">{addSessionIds.length} exam(s) to add</p>
            ) : null}
            {!isTeacherFlow && selectedSessionIds.length > 0 ? (
              <p className="mt-1 text-xs text-slate-500">{selectedSessionIds.length} session(s) selected</p>
            ) : null}
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">
              {isTeacherFlow ? "Reason for registration changes *" : "Reason for late registration *"}
            </span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder={
                isTeacherFlow
                  ? "Explain why these registration changes are needed"
                  : "Explain why this late registration is needed"
              }
            />
          </label>
        </div>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        <div className={`mt-6 flex ${isTeacherFlow ? "flex-wrap items-center justify-between gap-3" : "justify-end gap-2"}`}>
          {isTeacherFlow ? (
            <p className="text-sm text-slate-600">
              {pendingChangeCount} change{pendingChangeCount === 1 ? "" : "s"} selected
            </p>
          ) : null}
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
            {submitting ? "Submitting..." : submitLabel}
          </button>
          </div>
        </div>
      </div>
    </div>
  );
}
