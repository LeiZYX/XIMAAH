"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export type CieOptionRow = {
  id: string;
  syllabusCode: string;
  syllabusTitle: string | null;
  optionCode: string;
  componentCodes: string[];
  subjectId: string | null;
};

type ComposeSession = {
  id: string;
  paperCode: string;
  paperTitle: string;
  date: string;
};

type MatchPreview = {
  status: "exact" | "partial" | "extra" | "none";
  missing?: string[];
  extra?: string[];
  option?: { optionCode: string };
};

export type CieOptionRegistrationFormProps = {
  registrationWindowId: string;
  /** Pre-select syllabus (e.g. from calendar subject code). */
  initialSyllabusCode?: string;
  /** When set, register for this candidate (staff). Otherwise current student. */
  candidateId?: string;
  apiPath?: string;
  submitLabel?: string;
  showWithdraw?: boolean;
  onSuccess?: (result: { pendingConfirmation?: boolean; syllabusCode: string; optionCode: string }) => void;
  onError?: (message: string) => void;
  compact?: boolean;
};

export function CieOptionRegistrationForm({
  registrationWindowId,
  initialSyllabusCode,
  candidateId,
  apiPath = "/api/cie/registrations",
  submitLabel = "Register option",
  showWithdraw = true,
  onSuccess,
  onError,
  compact = false,
}: CieOptionRegistrationFormProps) {
  const [options, setOptions] = useState<CieOptionRow[]>([]);
  const [mode, setMode] = useState<"option" | "compose">("option");
  const [syllabusCode, setSyllabusCode] = useState(initialSyllabusCode ?? "");
  const [optionCode, setOptionCode] = useState("");
  const [sessions, setSessions] = useState<ComposeSession[]>([]);
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [match, setMatch] = useState<MatchPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reportError = useCallback(
    (msg: string) => {
      setError(msg);
      onError?.(msg);
    },
    [onError],
  );

  const loadOptions = useCallback(async () => {
    if (!registrationWindowId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${apiPath}?registrationWindowId=${encodeURIComponent(registrationWindowId)}`,
      );
      const data = (await res.json()) as { options?: CieOptionRow[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to load CIE options");
      setOptions(data.options ?? []);
    } catch (err) {
      setOptions([]);
      reportError(err instanceof Error ? err.message : "Failed to load options");
    } finally {
      setLoading(false);
    }
  }, [apiPath, registrationWindowId, reportError]);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    if (initialSyllabusCode) setSyllabusCode(initialSyllabusCode);
  }, [initialSyllabusCode]);

  const syllabuses = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const row of options) {
      if (!map.has(row.syllabusCode)) map.set(row.syllabusCode, row.syllabusTitle);
    }
    return [...map.entries()].map(([code, title]) => ({ code, title }));
  }, [options]);

  const optionsForSyllabus = useMemo(
    () => options.filter((row) => row.syllabusCode === syllabusCode),
    [options, syllabusCode],
  );

  const selectedOption = optionsForSyllabus.find((row) => row.optionCode === optionCode);

  useEffect(() => {
    if (!syllabusCode && syllabuses[0]) setSyllabusCode(syllabuses[0].code);
  }, [syllabusCode, syllabuses]);

  useEffect(() => {
    if (!optionCode && optionsForSyllabus[0]) setOptionCode(optionsForSyllabus[0].optionCode);
  }, [optionCode, optionsForSyllabus]);

  const loadSessions = useCallback(async () => {
    if (!registrationWindowId || !syllabusCode) {
      setSessions([]);
      return;
    }
    const subjectId = optionsForSyllabus[0]?.subjectId;
    const params = new URLSearchParams({
      registrationWindowId,
      syllabusCode,
    });
    if (subjectId) params.set("subjectId", subjectId);
    const res = await fetch(`/api/cie/sessions?${params.toString()}`);
    const data = (await res.json()) as { sessions?: ComposeSession[]; error?: string };
    if (!res.ok) {
      setSessions([]);
      reportError(data.error ?? "Failed to load sessions");
      return;
    }
    setSessions(data.sessions ?? []);
    setSelectedSessionIds([]);
    setMatch(null);
  }, [optionsForSyllabus, registrationWindowId, reportError, syllabusCode]);

  useEffect(() => {
    if (mode === "compose") void loadSessions();
  }, [loadSessions, mode]);

  useEffect(() => {
    if (mode !== "compose" || selectedSessionIds.length === 0 || !selectedOption?.subjectId) {
      setMatch(null);
      return;
    }
    const timer = window.setTimeout(() => {
      void (async () => {
        const res = await fetch(apiPath, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "preview-compose",
            registrationWindowId,
            subjectId: selectedOption.subjectId,
            examSessionIds: selectedSessionIds,
            ...(candidateId ? { candidateId } : {}),
          }),
        });
        const data = (await res.json()) as { match?: MatchPreview; error?: string };
        if (res.ok && data.match) setMatch(data.match);
      })();
    }, 200);
    return () => window.clearTimeout(timer);
  }, [
    apiPath,
    candidateId,
    mode,
    registrationWindowId,
    selectedOption?.subjectId,
    selectedSessionIds,
  ]);

  function toggleSession(id: string) {
    setSelectedSessionIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function submit() {
    if (!registrationWindowId || !syllabusCode) return;
    setSubmitting(true);
    setMessage(null);
    setError(null);
    try {
      const body =
        mode === "compose"
          ? {
              action: "register-compose",
              registrationWindowId,
              subjectId: selectedOption?.subjectId ?? optionsForSyllabus[0]?.subjectId,
              examSessionIds: selectedSessionIds,
              ...(candidateId ? { candidateId } : {}),
            }
          : {
              action: "register-option",
              registrationWindowId,
              syllabusCode,
              optionCode,
              subjectId: selectedOption?.subjectId ?? undefined,
              ...(candidateId ? { candidateId } : {}),
            };

      const res = await fetch(apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        error?: string;
        pendingConfirmation?: boolean;
        assignment?: { optionCode: string; syllabusCode: string };
      };
      if (!res.ok) throw new Error(data.error ?? "Registration failed");

      const finalOption =
        data.assignment?.optionCode ??
        (mode === "compose" ? match?.option?.optionCode : optionCode) ??
        optionCode;
      const msg = data.pendingConfirmation
        ? `Registered ${syllabusCode}/${finalOption} — awaiting subject-teacher confirmation.`
        : `Registered ${syllabusCode}/${finalOption}.`;
      setMessage(msg);
      onSuccess?.({
        pendingConfirmation: data.pendingConfirmation,
        syllabusCode,
        optionCode: finalOption,
      });
    } catch (err) {
      reportError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function withdraw() {
    if (!registrationWindowId || !syllabusCode) return;
    if (!window.confirm(`Withdraw entire syllabus ${syllabusCode}? All components will be removed.`)) {
      return;
    }
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "withdraw",
          registrationWindowId,
          syllabusCode,
          ...(candidateId ? { candidateId } : {}),
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Withdraw failed");
      setMessage(`Withdrew ${syllabusCode}.`);
      onSuccess?.({ syllabusCode, optionCode: "" });
    } catch (err) {
      reportError(err instanceof Error ? err.message : "Withdraw failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-600">Loading CIE options…</p>;
  }

  if (options.length === 0) {
    return (
      <p className="text-sm text-amber-800">
        No CIE options are configured for this series yet. Ask the Exams Office to import the option
        catalogue.
      </p>
    );
  }

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <div className="flex gap-2 text-sm">
        <button
          type="button"
          onClick={() => setMode("option")}
          className={`rounded-md px-3 py-1.5 font-medium ${
            mode === "option" ? "bg-indigo-600 text-white" : "border border-slate-300 text-slate-700"
          }`}
        >
          Select option
        </button>
        <button
          type="button"
          onClick={() => setMode("compose")}
          className={`rounded-md px-3 py-1.5 font-medium ${
            mode === "compose" ? "bg-indigo-600 text-white" : "border border-slate-300 text-slate-700"
          }`}
        >
          Compose option
        </button>
      </div>

      <div className={`grid gap-3 ${compact ? "" : "sm:grid-cols-2"}`}>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Syllabus</span>
          <select
            value={syllabusCode}
            onChange={(e) => {
              setSyllabusCode(e.target.value);
              setOptionCode("");
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {syllabuses.map((s) => (
              <option key={s.code} value={s.code}>
                {s.code}
                {s.title ? ` — ${s.title}` : ""}
              </option>
            ))}
          </select>
        </label>

        {mode === "option" ? (
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Option</span>
            <select
              value={optionCode}
              onChange={(e) => setOptionCode(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {optionsForSyllabus.map((o) => (
                <option key={o.id} value={o.optionCode}>
                  {o.optionCode} ({o.componentCodes.join(", ")})
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {mode === "compose" ? (
        <div className="space-y-2">
          <p className="text-sm text-slate-600">
            Tick components until they match a valid option. Incomplete combinations cannot be saved.
          </p>
          {sessions.length === 0 ? (
            <p className="text-sm text-amber-800">No exam sessions for this syllabus in the window.</p>
          ) : (
            <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
              {sessions.map((session) => (
                <li key={session.id}>
                  <label className="flex items-start gap-2 text-sm text-slate-800">
                    <input
                      type="checkbox"
                      checked={selectedSessionIds.includes(session.id)}
                      onChange={() => toggleSession(session.id)}
                      className="mt-1"
                    />
                    <span>
                      {session.paperCode} — {session.paperTitle}
                      <span className="block text-xs text-slate-500">
                        {new Date(session.date).toLocaleString()}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {match ? (
            <p
              className={`text-sm ${
                match.status === "exact" ? "text-emerald-800" : "text-amber-800"
              }`}
            >
              {match.status === "exact"
                ? `Matches option ${match.option?.optionCode ?? ""}.`
                : match.status === "partial"
                  ? `Missing: ${(match.missing ?? []).join(", ") || "—"}.`
                  : match.status === "extra"
                    ? `Extra: ${(match.extra ?? []).join(", ") || "—"}.`
                    : "Does not match a valid option."}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={
            submitting ||
            (mode === "option" ? !optionCode : match?.status !== "exact")
          }
          onClick={() => void submit()}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {submitting ? "Saving…" : submitLabel}
        </button>
        {showWithdraw ? (
          <button
            type="button"
            disabled={submitting || !syllabusCode}
            onClick={() => void withdraw()}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
          >
            Withdraw syllabus
          </button>
        ) : null}
      </div>

      {message ? <p className="text-sm text-emerald-800">{message}</p> : null}
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}
