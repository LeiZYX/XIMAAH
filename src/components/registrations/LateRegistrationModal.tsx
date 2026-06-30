"use client";

import { useEffect, useMemo, useState } from "react";
import {
  RegistrationWindowSelectorFields,
  useRegistrationWindowSelector,
} from "@/components/registrations/RegistrationWindowSelector";
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
}

interface ExamSessionOption extends ExamSessionSearchable {
  id: string;
}

interface LateRegistrationModalProps {
  title: string;
  submitLabel: string;
  apiPath: string;
  /** Teacher requests: OPEN windows only. Staff help: OPEN or CLOSED. */
  windowFilter?: "teacher" | "staff";
  onClose: () => void;
  onSubmitted: (result: { workspaceId?: string }) => void;
}

export function LateRegistrationModal({
  title,
  submitLabel,
  apiPath,
  windowFilter = "staff",
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
    examSeries: { id: string; name: string; year: number };
    examBoard: { id: string; name: string };
  } | null;
  const [subjectFilter, setSubjectFilter] = useState("");
  const [sessionQuery, setSessionQuery] = useState("");
  const [sessions, setSessions] = useState<ExamSessionOption[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    if (!subjectFilter.trim()) return items;
    const filter = subjectFilter.trim().toLowerCase();
    return items.filter((session) =>
      session.paper.subject.name.toLowerCase().includes(filter),
    );
  }, [sessions, sessionQuery, subjectFilter]);

  function toggleSession(id: string) {
    setSelectedSessionIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
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
    if (selectedSessionIds.length === 0) {
      setError("Please select at least one exam session.");
      return;
    }
    if (!reason.trim()) {
      setError("Reason is required.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: selectedStudent.id,
          registrationWindowId,
          examSessionIds: selectedSessionIds,
          reason: reason.trim(),
        }),
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
              },
            }}
          />

          {selectedWindow ? (
            <p className="text-sm text-slate-600">
              Exam Board: <span className="font-medium">{selectedWindow.examBoard.name}</span>
            </p>
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
            <span className="mb-1 block font-medium text-slate-700">Exam sessions *</span>
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
                <p className="px-3 py-2 text-sm text-slate-500">No exam sessions available.</p>
              ) : (
                visibleSessions.map((session) => (
                  <label
                    key={session.id}
                    className="flex cursor-pointer items-start gap-2 border-b border-slate-100 px-3 py-2 text-sm hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSessionIds.includes(session.id)}
                      onChange={() => toggleSession(session.id)}
                      className="mt-1"
                    />
                    <span>{formatExamSessionOptionLabel(session)}</span>
                  </label>
                ))
              )}
            </div>
            {selectedSessionIds.length > 0 ? (
              <p className="mt-1 text-xs text-slate-500">{selectedSessionIds.length} session(s) selected</p>
            ) : null}
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Reason for late registration *</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Explain why this late registration is needed"
            />
          </label>
        </div>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

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
            {submitting ? "Submitting..." : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
