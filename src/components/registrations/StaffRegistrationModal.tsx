"use client";

import { useEffect, useMemo, useState } from "react";
import {
  EXAM_SESSION_PREVIEW_LIMIT,
  EXAM_SESSION_SEARCH_LIMIT,
  formatExamSessionOptionLabel,
  limitExamSessions,
  type ExamSessionSearchable,
} from "@/lib/exam-session-search";

interface CandidateOption {
  id: string;
  englishName: string;
  assessmentHubCandidateNumber: string;
  studentNumber: string | null;
  grade: string | null;
  className: string | null;
}

interface RegistrationWindowOption {
  id: string;
  title: string;
  status: string;
  examBoard: { id: string; name: string };
  examSeries: { id: string; name: string; year: number };
}

interface ExamSessionOption extends ExamSessionSearchable {
  id: string;
}

export type StaffRegistrationMode = "assisted" | "office-only";

interface StaffRegistrationModalProps {
  mode: StaffRegistrationMode;
  title: string;
  submitLabel: string;
  apiPath: string;
  candidateType?: "INTERNAL" | "EXTERNAL";
  onClose: () => void;
  onSubmitted: (result: { workspaceId?: string }) => void;
}

export function StaffRegistrationModal({
  mode,
  title,
  submitLabel,
  apiPath,
  candidateType = "INTERNAL",
  onClose,
  onSubmitted,
}: StaffRegistrationModalProps) {
  const isOfficeOnly = mode === "office-only";
  const [candidateQuery, setCandidateQuery] = useState("");
  const [candidates, setCandidates] = useState<CandidateOption[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateOption | null>(null);
  const [windows, setWindows] = useState<RegistrationWindowOption[]>([]);
  const [registrationWindowId, setRegistrationWindowId] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [sessionQuery, setSessionQuery] = useState("");
  const [sessions, setSessions] = useState<ExamSessionOption[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedWindow = windows.find((window) => window.id === registrationWindowId) ?? null;

  useEffect(() => {
    fetch("/api/registration-windows")
      .then((r) => r.json())
      .then((data) => {
        const all = Array.isArray(data) ? data : [];
        setWindows(
          isOfficeOnly
            ? all.filter((window: RegistrationWindowOption) => window.status !== "DRAFT")
            : all.filter(
                (window: RegistrationWindowOption) =>
                  window.status === "OPEN" || window.status === "CLOSED",
              ),
        );
      })
      .catch(() => setWindows([]));
  }, [isOfficeOnly]);

  useEffect(() => {
    if (candidateQuery.trim().length < 2) {
      setCandidates([]);
      return;
    }
    const handle = window.setTimeout(() => {
      setCandidatesLoading(true);
      const params = new URLSearchParams({
        q: candidateQuery.trim(),
        candidateType,
      });
      fetch(`/api/candidates/search?${params.toString()}`)
        .then((r) => r.json())
        .then((data) => setCandidates(Array.isArray(data) ? data : []))
        .catch(() => setCandidates([]))
        .finally(() => setCandidatesLoading(false));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [candidateQuery, candidateType]);

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
    if (!selectedCandidate) {
      setError("Please select an internal candidate.");
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
      const body = {
        candidateId: selectedCandidate.id,
        registrationWindowId,
        examSessionIds: selectedSessionIds,
        reason: reason.trim(),
      };

      const response = await fetch(apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Could not submit registration");
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
        {isOfficeOnly ? (
          <p className="mt-1 text-sm text-amber-800">
            Office-only registrations are hidden from students and teachers.
          </p>
        ) : (
          <p className="mt-1 text-sm text-slate-600">
            The internal candidate and assigned subject teachers will see this registration.
          </p>
        )}

        <div className="mt-4 space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Internal candidate search *</span>
            <input
              value={candidateQuery}
              onChange={(e) => setCandidateQuery(e.target.value)}
              placeholder="Name, AH number, or student number"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            {selectedCandidate ? (
              <p className="mt-2 text-sm text-indigo-700">
                Selected: {selectedCandidate.englishName} ({selectedCandidate.assessmentHubCandidateNumber})
                {selectedCandidate.studentNumber ? ` · ${selectedCandidate.studentNumber}` : ""}
              </p>
            ) : null}
            <div className="mt-2 max-h-36 overflow-y-auto rounded-lg border border-slate-200">
              {candidatesLoading ? (
                <p className="px-3 py-2 text-sm text-slate-500">Searching...</p>
              ) : candidates.length === 0 ? (
                <p className="px-3 py-2 text-sm text-slate-500">
                  {candidateQuery.trim().length >= 2 ? "No candidates found." : "Type at least 2 characters."}
                </p>
              ) : (
                candidates.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => setSelectedCandidate(candidate)}
                    className={`block w-full px-3 py-2 text-left text-sm hover:bg-indigo-50 ${
                      selectedCandidate?.id === candidate.id ? "bg-indigo-50 font-medium text-indigo-800" : ""
                    }`}
                  >
                    {candidate.englishName} · {candidate.assessmentHubCandidateNumber}
                    {candidate.studentNumber ? ` · ${candidate.studentNumber}` : ""}
                  </button>
                ))
              )}
            </div>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Registration window *</span>
            <select
              value={registrationWindowId}
              onChange={(e) => {
                setRegistrationWindowId(e.target.value);
                setSelectedSessionIds([]);
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select registration window</option>
              {windows.map((window) => (
                <option key={window.id} value={window.id}>
                  {window.title} — {window.examBoard.name} · {window.examSeries.name} ({window.status})
                </option>
              ))}
            </select>
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
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Reason *</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={submitting} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {submitting ? "Submitting..." : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
