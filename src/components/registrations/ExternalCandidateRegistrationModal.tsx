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

interface CandidateOption {
  id: string;
  englishName: string;
  assessmentHubCandidateNumber: string;
  email: string | null;
}

interface ExamSessionOption extends ExamSessionSearchable {
  id: string;
}

export function ExternalCandidateRegistrationModal({
  apiPath,
  onClose,
  onSubmitted,
}: {
  apiPath: string;
  onClose: () => void;
  onSubmitted: (result: { workspaceId?: string }) => void;
}) {
  const [useExisting, setUseExisting] = useState(true);
  const [candidateQuery, setCandidateQuery] = useState("");
  const [candidates, setCandidates] = useState<CandidateOption[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateOption | null>(null);
  const [newCandidate, setNewCandidate] = useState({
    englishName: "",
    chineseName: "",
    email: "",
    phone: "",
    schoolName: "",
    assessmentHubCandidateNumber: "",
    externalId: "",
  });
  const windowSelector = useRegistrationWindowSelector({ scope: "external" });
  const registrationWindowId = windowSelector.registrationWindowId;
  const selectedWindow = windowSelector.selectedWindow;
  const [sessionQuery, setSessionQuery] = useState("");
  const [sessions, setSessions] = useState<ExamSessionOption[]>([]);
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!useExisting || candidateQuery.trim().length < 2) {
      setCandidates([]);
      return;
    }
    const handle = window.setTimeout(() => {
      fetch(
        `/api/candidates/search?q=${encodeURIComponent(candidateQuery.trim())}&candidateType=EXTERNAL`,
      )
        .then((r) => r.json())
        .then((data) => setCandidates(Array.isArray(data) ? data : []))
        .catch(() => setCandidates([]));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [candidateQuery, useExisting]);

  useEffect(() => {
    if (!selectedWindow?.examSeries?.id) {
      setSessions([]);
      return;
    }
    const params = new URLSearchParams({ examSeriesId: selectedWindow.examSeries.id, limit: "50" });
    fetch(`/api/exam-sessions?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => setSessions(Array.isArray(data) ? data : []))
      .catch(() => setSessions([]));
  }, [selectedWindow]);

  const visibleSessions = useMemo(() => limitExamSessions(sessions, sessionQuery).items, [sessions, sessionQuery]);

  async function handleSubmit() {
    setError(null);
    if (useExisting && !selectedCandidate) {
      setError("Select an existing external candidate or create a new one.");
      return;
    }
    if (!useExisting && !newCandidate.englishName.trim()) {
      setError("English name is required for new external candidate.");
      return;
    }
    if (!registrationWindowId || selectedSessionIds.length === 0 || !reason.trim()) {
      setError("Registration window, exam sessions, and reason are required.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateId: useExisting ? selectedCandidate?.id : undefined,
          newCandidate: useExisting ? undefined : newCandidate,
          registrationWindowId,
          examSessionIds: selectedSessionIds,
          reason: reason.trim(),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not submit registration");
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
        <h2 className="text-lg font-semibold text-slate-900">Register external candidate</h2>
        <p className="mt-1 text-sm text-amber-800">
          External registrations are visible to the Exams Office only. Teachers cannot see them. Login is disabled by default.
        </p>

        <div className="mt-4 space-y-4">
          <label className="flex items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="radio" checked={useExisting} onChange={() => setUseExisting(true)} />
              Search existing
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={!useExisting} onChange={() => setUseExisting(false)} />
              Create new
            </label>
          </label>

          {useExisting ? (
            <>
              <input
                value={candidateQuery}
                onChange={(e) => setCandidateQuery(e.target.value)}
                placeholder="Search external candidate"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <div className="max-h-32 overflow-y-auto rounded-lg border border-slate-200">
                {candidates.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => setSelectedCandidate(candidate)}
                    className={`block w-full px-3 py-2 text-left text-sm hover:bg-indigo-50 ${
                      selectedCandidate?.id === candidate.id ? "bg-indigo-50" : ""
                    }`}
                  >
                    {candidate.englishName} · {candidate.assessmentHubCandidateNumber}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {(["englishName", "chineseName", "email", "phone", "schoolName", "externalId"] as const).map(
                (field) => (
                  <input
                    key={field}
                    placeholder={field}
                    value={newCandidate[field]}
                    onChange={(e) => setNewCandidate({ ...newCandidate, [field]: e.target.value })}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                ),
              )}
            </div>
          )}

          <RegistrationWindowSelectorFields
            state={{
              ...windowSelector,
              setRegistrationWindowId: (id) => {
                windowSelector.setRegistrationWindowId(id);
                setSelectedSessionIds([]);
              },
            }}
          />

          <input
            value={sessionQuery}
            onChange={(e) => setSessionQuery(e.target.value)}
            placeholder="Search exam sessions"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200">
            {visibleSessions.map((session) => (
              <label key={session.id} className="flex gap-2 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedSessionIds.includes(session.id)}
                  onChange={() =>
                    setSelectedSessionIds((current) =>
                      current.includes(session.id)
                        ? current.filter((id) => id !== session.id)
                        : [...current, session.id],
                    )
                  }
                />
                {formatExamSessionOptionLabel(session)}
              </label>
            ))}
          </div>

          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Reason"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Register external candidate"}
          </button>
        </div>
      </div>
    </div>
  );
}
