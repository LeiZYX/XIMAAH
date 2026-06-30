"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ApplicableExamSessionsPicker } from "@/components/registrations/ApplicableExamSessionsPicker";
import { ExamBoardRadioList } from "@/components/registrations/ExamBoardRadioList";
import { PageHeader } from "@/components/ui/PageHeader";
import { datetimeLocalValueToIso } from "@/lib/datetime-local";
import {
  formatIncludedSessionShortLabel,
  type IncludedExamSession,
} from "@/lib/registrations/included-series";

interface WindowRow {
  id: string;
  title: string;
  studentRegistrationOpenAt: string;
  studentRegistrationCloseAt: string;
  registrationCloseAt: string;
  status: string;
  examBoard?: { id: string; name: string; code: string };
  includedExamSessions?: IncludedExamSession[];
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

interface RegistrationWindowManagerProps {
  basePath?: "/admin/registration-windows" | "/exam-office/registration-windows";
}

const STATUS_OPTIONS = [
  { value: "DRAFT", label: "Draft" },
  { value: "OPEN", label: "Active" },
  { value: "CLOSED", label: "Closed" },
] as const;

function statusLabel(status: string): string {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}

function formatListDate(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function SectionHeading({ title }: { title: string }) {
  return <h3 className="mb-3 text-sm font-semibold text-slate-900">{title}</h3>;
}

export function RegistrationWindowManager({
  basePath = "/admin/registration-windows",
}: RegistrationWindowManagerProps) {
  const [windows, setWindows] = useState<WindowRow[]>([]);
  const [examBoards, setExamBoards] = useState<ExamBoardOption[]>([]);
  const [sessions, setSessions] = useState<SelectableSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    examBoardId: "",
    examSeriesIds: [] as string[],
    studentRegistrationOpenAt: "",
    studentRegistrationCloseAt: "",
    registrationCloseAt: "",
    status: "DRAFT",
    lateEntryEnabled: true,
    highLateEntryEnabled: true,
  });

  async function loadWindows() {
    try {
      const res = await fetch("/api/registration-windows");
      const data = res.ok ? await res.json() : [];
      setWindows(Array.isArray(data) ? data : []);
    } catch {
      setWindows([]);
    }
  }

  async function loadExamBoards() {
    try {
      const res = await fetch("/api/exam-boards");
      const data = res.ok ? await res.json() : [];
      const boards = Array.isArray(data) ? (data as ExamBoardOption[]) : [];
      setExamBoards(boards);
      if (boards.length > 0) {
        setForm((current) =>
          current.examBoardId ? current : { ...current, examBoardId: boards[0]!.id },
        );
      }
    } catch {
      setExamBoards([]);
    }
  }

  async function loadSessions(examBoardId: string) {
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
    } catch {
      setSessions([]);
    } finally {
      setSessionsLoading(false);
    }
  }

  useEffect(() => {
    void loadWindows();
    void loadExamBoards();
  }, []);

  useEffect(() => {
    void loadSessions(form.examBoardId);
  }, [form.examBoardId]);

  const selectedBoard = useMemo(
    () => examBoards.find((board) => board.id === form.examBoardId) ?? null,
    [examBoards, form.examBoardId],
  );

  function handleExamBoardChange(examBoardId: string) {
    setForm((current) => ({
      ...current,
      examBoardId,
      examSeriesIds: [],
    }));
    setFormError(null);
  }

  function toggleSession(sessionId: string, selected: boolean) {
    setForm((current) => ({
      ...current,
      examSeriesIds: selected
        ? [...current.examSeriesIds, sessionId]
        : current.examSeriesIds.filter((id) => id !== sessionId),
    }));
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (creating) return;
    if (!form.title.trim()) {
      setFormError("Window name is required.");
      return;
    }
    if (!form.examBoardId) {
      setFormError("Exam board is required.");
      return;
    }
    if (form.examSeriesIds.length === 0) {
      setFormError("Select at least one applicable exam session.");
      return;
    }
    if (!form.studentRegistrationOpenAt || !form.studentRegistrationCloseAt || !form.registrationCloseAt) {
      setFormError("All registration timeline dates are required.");
      return;
    }

    setCreating(true);
    setFormError(null);
    try {
      const response = await fetch("/api/registration-windows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          examBoardId: form.examBoardId,
          examSeriesIds: form.examSeriesIds,
          status: form.status,
          lateEntryEnabled: form.lateEntryEnabled,
          highLateEntryEnabled: form.highLateEntryEnabled,
          studentRegistrationOpenAt: datetimeLocalValueToIso(form.studentRegistrationOpenAt),
          studentRegistrationCloseAt: datetimeLocalValueToIso(form.studentRegistrationCloseAt),
          registrationCloseAt: datetimeLocalValueToIso(form.registrationCloseAt),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setFormError(typeof body.error === "string" ? body.error : "Failed to create window");
        return;
      }

      const firstBoardId = examBoards[0]?.id ?? "";
      setForm({
        title: "",
        examBoardId: firstBoardId,
        examSeriesIds: [],
        studentRegistrationOpenAt: "",
        studentRegistrationCloseAt: "",
        registrationCloseAt: "",
        status: "DRAFT",
        lateEntryEnabled: true,
        highLateEntryEnabled: true,
      });
      if (firstBoardId) {
        await loadSessions(firstBoardId);
      } else {
        setSessions([]);
      }
      await loadWindows();
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Registration windows"
        description="Create board-scoped registration periods for exam office operations."
      />

      <section className="border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-900">Create registration window</h2>
        </div>

        <form onSubmit={handleCreate} className="divide-y divide-slate-200">
          <div className="px-4 py-4">
            <SectionHeading title="Basic information" />
            <div className="grid gap-4 sm:max-w-xl">
              <label className="block text-sm">
                <span className="mb-1 block text-slate-700">
                  Window name <span className="text-red-600">*</span>
                </span>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Summer 2027 Registration"
                  className="w-full border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-700">Status</span>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full border border-slate-300 px-3 py-2 text-sm sm:max-w-xs"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="px-4 py-4">
            <SectionHeading title="Exam board & applicable exam sessions" />
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Exam board
                </p>
                <ExamBoardRadioList
                  boards={examBoards}
                  value={form.examBoardId}
                  onChange={handleExamBoardChange}
                />
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Applicable exam sessions
                  </p>
                  <span className="text-xs text-slate-500">{form.examSeriesIds.length} selected</span>
                </div>
                {selectedBoard ? (
                  <p className="mb-2 text-xs text-slate-600">{selectedBoard.name} sessions only</p>
                ) : null}
                <ApplicableExamSessionsPicker
                  sessions={sessions}
                  selectedIds={form.examSeriesIds}
                  onToggle={toggleSession}
                  loading={sessionsLoading}
                  emptyMessage={
                    form.examBoardId
                      ? "No exam sessions found for this board."
                      : "Select an exam board to load sessions."
                  }
                />
              </div>
            </div>
          </div>

          <div className="px-4 py-4">
            <SectionHeading title="Registration timeline" />
            <div className="grid gap-3 sm:max-w-xl">
              <label className="block text-sm">
                <span className="mb-1 block text-slate-700">Student registration open</span>
                <input
                  required
                  type="datetime-local"
                  value={form.studentRegistrationOpenAt}
                  onChange={(e) =>
                    setForm({ ...form, studentRegistrationOpenAt: e.target.value })
                  }
                  className="w-full border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-700">
                  Student registration close (normal deadline)
                </span>
                <input
                  required
                  type="datetime-local"
                  value={form.studentRegistrationCloseAt}
                  onChange={(e) =>
                    setForm({ ...form, studentRegistrationCloseAt: e.target.value })
                  }
                  className="w-full border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-700">
                  Registration close (final deadline)
                </span>
                <input
                  required
                  type="datetime-local"
                  value={form.registrationCloseAt}
                  onChange={(e) => setForm({ ...form, registrationCloseAt: e.target.value })}
                  className="w-full border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
            </div>
          </div>

          <div className="px-4 py-4">
            <SectionHeading title="Optional fee stages" />
            <div className="space-y-2 text-sm text-slate-700">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.lateEntryEnabled}
                  onChange={(e) => setForm({ ...form, lateEntryEnabled: e.target.checked })}
                />
                Late entry
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.highLateEntryEnabled}
                  onChange={(e) => setForm({ ...form, highLateEntryEnabled: e.target.checked })}
                />
                High late entry
              </label>
            </div>
          </div>

          {formError ? <p className="px-4 text-sm text-red-700">{formError}</p> : null}

          <div className="flex items-center justify-between px-4 py-3">
            <p className="text-xs text-slate-500">
              {!form.examBoardId
                ? "Select an exam board."
                : form.examSeriesIds.length === 0
                  ? "Select at least one applicable exam session."
                  : `${form.examSeriesIds.length} session(s) selected for ${selectedBoard?.name ?? "board"}.`}
            </p>
            <button
              type="submit"
              disabled={
                creating ||
                !form.examBoardId ||
                form.examSeriesIds.length === 0 ||
                !form.title.trim()
              }
              className="bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create window"}
            </button>
          </div>
        </form>
      </section>

      <section className="border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-900">Registration windows</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Window name</th>
                <th className="px-3 py-2">Exam board</th>
                <th className="px-3 py-2">Included sessions</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Open date</th>
                <th className="px-3 py-2">Close date</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {windows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-500">
                    No registration windows yet.
                  </td>
                </tr>
              ) : (
                windows.map((window) => (
                  <tr key={window.id} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-2 font-medium text-slate-900">{window.title}</td>
                    <td className="px-3 py-2 text-slate-700">{window.examBoard?.name ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {(window.includedExamSessions ?? []).length > 0 ? (
                        <ul className="list-inside list-disc space-y-0.5">
                          {window.includedExamSessions!.map((session) => (
                            <li key={session.id}>{formatIncludedSessionShortLabel(session)}</li>
                          ))}
                        </ul>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2">{statusLabel(window.status)}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {formatListDate(window.studentRegistrationOpenAt)}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {formatListDate(window.registrationCloseAt)}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`${basePath}/${window.id}`}
                        className="text-indigo-700 hover:underline"
                      >
                        Manage
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
