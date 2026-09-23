"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";

type CieOption = {
  id: string;
  syllabusCode: string;
  syllabusTitle: string | null;
  optionCode: string;
  componentCodes: string[];
  subjectId: string | null;
};

type OpenWindow = {
  id: string;
  title: string;
  examBoard: { code: string; name: string };
};

interface StudentCieRegistrationPanelProps {
  onChanged?: () => void;
}

export function StudentCieRegistrationPanel({ onChanged }: StudentCieRegistrationPanelProps) {
  const [windows, setWindows] = useState<OpenWindow[]>([]);
  const [windowId, setWindowId] = useState("");
  const [options, setOptions] = useState<CieOption[]>([]);
  const [syllabusCode, setSyllabusCode] = useState("");
  const [optionCode, setOptionCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadWindows = useCallback(async () => {
    const res = await fetch("/api/registration-windows?scope=student&allYears=true");
    if (!res.ok) return;
    const data = (await res.json()) as OpenWindow[];
    const list = Array.isArray(data) ? data : [];
    const cie = list.filter(
      (w) =>
        w.examBoard?.code?.toUpperCase() === "CIE" ||
        w.examBoard?.name?.toLowerCase().includes("cambridge"),
    );
    setWindows(cie);
    if (cie[0] && !windowId) setWindowId(cie[0].id);
  }, [windowId]);

  const loadOptions = useCallback(async (registrationWindowId: string) => {
    if (!registrationWindowId) {
      setOptions([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/cie/registrations?registrationWindowId=${encodeURIComponent(registrationWindowId)}`,
      );
      const data = (await res.json()) as { options?: CieOption[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to load CIE options");
      setOptions(data.options ?? []);
    } catch (err) {
      setOptions([]);
      setError(err instanceof Error ? err.message : "Failed to load options");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWindows();
  }, [loadWindows]);

  useEffect(() => {
    if (windowId) void loadOptions(windowId);
  }, [loadOptions, windowId]);

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

  useEffect(() => {
    if (!syllabusCode && syllabuses[0]) setSyllabusCode(syllabuses[0].code);
  }, [syllabusCode, syllabuses]);

  useEffect(() => {
    if (!optionCode && optionsForSyllabus[0]) setOptionCode(optionsForSyllabus[0].optionCode);
  }, [optionCode, optionsForSyllabus]);

  async function registerOption() {
    if (!windowId || !syllabusCode || !optionCode) return;
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const selected = optionsForSyllabus.find((row) => row.optionCode === optionCode);
      const res = await fetch("/api/cie/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "register-option",
          registrationWindowId: windowId,
          syllabusCode,
          optionCode,
          subjectId: selected?.subjectId ?? undefined,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        pendingConfirmation?: boolean;
      };
      if (!res.ok) throw new Error(data.error ?? "Registration failed");
      setMessage(
        data.pendingConfirmation
          ? `Registered ${syllabusCode}/${optionCode} — awaiting subject-teacher confirmation.`
          : `Registered ${syllabusCode}/${optionCode}.`,
      );
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (windows.length === 0) return null;

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-slate-900">Cambridge (CIE) registration</h2>
        <p className="text-sm text-slate-600">
          Choose a syllabus option. The system adds all required components for that option.
        </p>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block text-slate-600">Registration window</span>
        <select
          value={windowId}
          onChange={(e) => {
            setWindowId(e.target.value);
            setSyllabusCode("");
            setOptionCode("");
          }}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          {windows.map((w) => (
            <option key={w.id} value={w.id}>
              {w.title}
            </option>
          ))}
        </select>
      </label>

      {loading ? (
        <p className="text-sm text-slate-600">Loading options…</p>
      ) : options.length === 0 ? (
        <p className="text-sm text-amber-800">
          No CIE options are configured for this series yet. Ask the Exams Office to import the
          option catalogue.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
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
        </div>
      )}

      <button
        type="button"
        disabled={submitting || !optionCode || options.length === 0}
        onClick={() => void registerOption()}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {submitting ? "Saving…" : "Register option"}
      </button>

      {message ? <p className="text-sm text-emerald-800">{message}</p> : null}
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
    </Card>
  );
}
