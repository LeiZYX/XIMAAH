"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { ApplicableExamSessionsPicker } from "@/components/registrations/ApplicableExamSessionsPicker";
import { ExamBoardRadioList } from "@/components/registrations/ExamBoardRadioList";
import { IncludedExamSessionsList } from "@/components/registrations/IncludedExamSessionsList";
import { Card } from "@/components/ui/Card";
import { datetimeLocalValueToIso, isoToDatetimeLocalValue } from "@/lib/datetime-local";
import {
  getCurrentAcademicYear,
  mergeAcademicYearOptions,
} from "@/lib/registrations/academic-year";
import type { IncludedExamSession } from "@/lib/registrations/included-series";

interface WindowDetail {
  id: string;
  title: string;
  academicYear: string;
  studentRegistrationOpenAt: string;
  studentRegistrationCloseAt: string;
  registrationCloseAt: string;
  status: string;
  studentSelfRegistrationEnabled: boolean;
  eoAssistedRegistrationEnabled: boolean;
  officeOnlyRegistrationEnabled: boolean;
  postLockAdjustmentEnabled: boolean;
  examBoard: { id: string; code: string; name: string };
  examSeries: { id: string; name: string; year: number };
  includedExamSessions?: IncludedExamSession[];
  studentStateLabel?: string;
  currentFeeStage?: string;
}

interface ExamBoardOption {
  id: string;
  name: string;
  code: string;
}

interface SelectableSession {
  id: string;
  name: string;
  year: number;
  startDate: string | null;
  endDate: string | null;
}

interface RegistrationWindowGeneralProps {
  windowId: string;
  canEdit?: boolean;
}

const STATUS_OPTIONS = [
  { value: "DRAFT", label: "Draft" },
  { value: "OPEN", label: "Active" },
  { value: "CLOSED", label: "Closed" },
  { value: "ARCHIVED", label: "Archived" },
] as const;

function statusLabel(status: string): string {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}

export function RegistrationWindowGeneral({
  windowId,
  canEdit = true,
}: RegistrationWindowGeneralProps) {
  const [window, setWindow] = useState<WindowDetail | null>(null);
  const [examBoards, setExamBoards] = useState<ExamBoardOption[]>([]);
  const [sessions, setSessions] = useState<SelectableSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [examSeriesIds, setExamSeriesIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [academicYearOptions, setAcademicYearOptions] = useState<string[]>([
    getCurrentAcademicYear(),
  ]);

  const loadSessions = useCallback(async (examBoardId: string) => {
    if (!examBoardId) {
      setSessions([]);
      return;
    }
    setSessionsLoading(true);
    try {
      const params = new URLSearchParams({ examBoardId });
      const res = await fetch(`/api/exam-series?${params.toString()}`);
      const data = res.ok ? await res.json() : [];
      setSessions(
        Array.isArray(data)
          ? data.map((row: SelectableSession & { startDate?: string; endDate?: string }) => ({
              id: row.id,
              name: row.name,
              year: row.year,
              startDate: row.startDate ?? null,
              endDate: row.endDate ?? null,
            }))
          : [],
      );
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    const res = await fetch(`/api/registration-windows/${windowId}`);
    if (!res.ok) return;
    const data = (await res.json()) as WindowDetail;
    setWindow({
      ...data,
      studentRegistrationOpenAt: isoToDatetimeLocalValue(data.studentRegistrationOpenAt),
      studentRegistrationCloseAt: isoToDatetimeLocalValue(data.studentRegistrationCloseAt),
      registrationCloseAt: isoToDatetimeLocalValue(data.registrationCloseAt),
    });
    setExamSeriesIds((data.includedExamSessions ?? []).map((session) => session.examSeriesId));
    await loadSessions(data.examBoard.id);
  }, [loadSessions, windowId]);

  useEffect(() => {
    void load();
    fetch("/api/exam-boards")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setExamBoards(Array.isArray(data) ? data : []));
    fetch("/api/registration-windows?yearsOnly=true")
      .then((r) => (r.ok ? r.json() : { years: [] }))
      .then((data) => {
        const years = Array.isArray(data?.years) ? (data.years as string[]) : [];
        setAcademicYearOptions(mergeAcademicYearOptions(years));
      })
      .catch(() => setAcademicYearOptions(mergeAcademicYearOptions([])));
  }, [load]);

  function handleExamBoardChange(examBoardId: string) {
    if (!window) return;
    const board = examBoards.find((item) => item.id === examBoardId);
    if (!board) return;
    setWindow({ ...window, examBoard: board });
    setExamSeriesIds([]);
    void loadSessions(examBoardId);
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!window || !canEdit) return;
    if (examSeriesIds.length === 0) {
      setError("Select at least one applicable exam session.");
      return;
    }

    setSaving(true);
    setMessage(null);
    setError(null);

    const res = await fetch(`/api/registration-windows/${windowId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: window.title,
        academicYear: window.academicYear,
        examBoardId: window.examBoard.id,
        examSeriesIds,
        studentRegistrationOpenAt: datetimeLocalValueToIso(window.studentRegistrationOpenAt),
        studentRegistrationCloseAt: datetimeLocalValueToIso(window.studentRegistrationCloseAt),
        registrationCloseAt: datetimeLocalValueToIso(window.registrationCloseAt),
        status: window.status,
        studentSelfRegistrationEnabled: window.studentSelfRegistrationEnabled,
        eoAssistedRegistrationEnabled: window.eoAssistedRegistrationEnabled,
        officeOnlyRegistrationEnabled: window.officeOnlyRegistrationEnabled,
        postLockAdjustmentEnabled: window.postLockAdjustmentEnabled,
      }),
    });

    setSaving(false);
    if (res.ok) {
      await load();
      setMessage("Settings saved.");
    } else {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Failed to save settings.");
    }
  }

  if (!window) {
    return (
      <Card>
        <p className="text-sm text-slate-600">Loading window details…</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {message ? <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{message}</p> : null}
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}

      <Card>
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Overview</h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase text-slate-500">Window name</dt>
            <dd className="text-sm font-medium text-slate-900">{window.title}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Academic year</dt>
            <dd className="text-sm font-medium text-slate-900">{window.academicYear}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Exam board</dt>
            <dd className="text-sm font-medium text-slate-900">{window.examBoard.name}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase text-slate-500">Included sessions</dt>
            <dd className="mt-1">
              <IncludedExamSessionsList sessions={window.includedExamSessions ?? []} />
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Status</dt>
            <dd className="text-sm font-medium text-slate-900">{statusLabel(window.status)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Current student registration state</dt>
            <dd className="text-sm font-medium text-slate-900">{window.studentStateLabel ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Current fee stage</dt>
            <dd className="text-sm font-medium text-slate-900">{window.currentFeeStage ?? "Not Configured"}</dd>
          </div>
        </dl>
      </Card>

      {canEdit ? (
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Settings</h2>
          <form onSubmit={handleSave} className="space-y-6">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">Basic information</h3>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-600">
                  Academic Year <span className="text-red-600">*</span>
                </span>
                <select
                  required
                  value={window.academicYear}
                  onChange={(e) => setWindow({ ...window, academicYear: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:max-w-xs"
                >
                  {academicYearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-600">Window name</span>
                <input
                  required
                  value={window.title}
                  onChange={(e) => setWindow({ ...window, title: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-600">Status</span>
                <select
                  value={window.status}
                  onChange={(e) => setWindow({ ...window, status: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:max-w-xs"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">Exam board & applicable exam sessions</h3>
              <div className="grid gap-6 lg:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                    Exam board
                  </p>
                  <ExamBoardRadioList
                    boards={examBoards}
                    value={window.examBoard.id}
                    onChange={handleExamBoardChange}
                  />
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                    Applicable exam sessions
                  </p>
                  <ApplicableExamSessionsPicker
                    sessions={sessions}
                    selectedIds={examSeriesIds}
                    onToggle={(sessionId, selected) =>
                      setExamSeriesIds((current) =>
                        selected
                          ? [...current, sessionId]
                          : current.filter((id) => id !== sessionId),
                      )
                    }
                    loading={sessionsLoading}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">Registration timeline</h3>
              <div className="grid gap-3 sm:max-w-xl">
                <label className="text-sm">
                  <span className="mb-1 block text-slate-600">Student registration open</span>
                  <input
                    required
                    type="datetime-local"
                    value={window.studentRegistrationOpenAt}
                    onChange={(e) => setWindow({ ...window, studentRegistrationOpenAt: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-slate-600">
                    Student registration close (normal deadline)
                  </span>
                  <input
                    required
                    type="datetime-local"
                    value={window.studentRegistrationCloseAt}
                    onChange={(e) => setWindow({ ...window, studentRegistrationCloseAt: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-slate-600">
                    Registration close (final deadline)
                  </span>
                  <input
                    required
                    type="datetime-local"
                    value={window.registrationCloseAt}
                    onChange={(e) => setWindow({ ...window, registrationCloseAt: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
              </div>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-slate-700">Registration permissions</legend>
              {(
                [
                  ["studentSelfRegistrationEnabled", "Student self-registration enabled"],
                  ["eoAssistedRegistrationEnabled", "Exam Officer assisted registration enabled"],
                  ["officeOnlyRegistrationEnabled", "Restricted registration enabled"],
                  ["postLockAdjustmentEnabled", "Post-lock adjustment enabled"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={window[key]}
                    onChange={(e) => setWindow({ ...window, [key]: e.target.checked })}
                    className="rounded border-slate-300"
                  />
                  {label}
                </label>
              ))}
            </fieldset>

            <button
              type="submit"
              disabled={saving || examSeriesIds.length === 0}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save settings"}
            </button>
          </form>
        </Card>
      ) : (
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Registration permissions</h2>
          <ul className="space-y-1 text-sm text-slate-700">
            <li>Student self-registration: {window.studentSelfRegistrationEnabled ? "Enabled" : "Disabled"}</li>
            <li>EO assisted registration: {window.eoAssistedRegistrationEnabled ? "Enabled" : "Disabled"}</li>
            <li>Restricted registration: {window.officeOnlyRegistrationEnabled ? "Enabled" : "Disabled"}</li>
            <li>Post-lock adjustment: {window.postLockAdjustmentEnabled ? "Enabled" : "Disabled"}</li>
          </ul>
        </Card>
      )}
    </div>
  );
}
