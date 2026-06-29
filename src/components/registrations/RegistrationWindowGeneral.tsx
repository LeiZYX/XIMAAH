"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { datetimeLocalValueToIso, isoToDatetimeLocalValue } from "@/lib/datetime-local";

interface WindowDetail {
  id: string;
  title: string;
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
  studentStateLabel?: string;
  currentFeeStage?: string;
}

interface RegistrationWindowGeneralProps {
  windowId: string;
  canEdit?: boolean;
}

function statusLabel(status: string): string {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "OPEN":
      return "Open";
    case "CLOSED":
      return "Closed";
    case "ARCHIVED":
      return "Archived";
    default:
      return status;
  }
}

export function RegistrationWindowGeneral({
  windowId,
  canEdit = true,
}: RegistrationWindowGeneralProps) {
  const [window, setWindow] = useState<WindowDetail | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
  }, [windowId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!window || !canEdit) return;
    setSaving(true);
    setMessage(null);
    setError(null);

    const res = await fetch(`/api/registration-windows/${windowId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: window.title,
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
      const data = (await res.json()) as WindowDetail;
      setWindow({
        ...data,
        studentRegistrationOpenAt: isoToDatetimeLocalValue(data.studentRegistrationOpenAt),
        studentRegistrationCloseAt: isoToDatetimeLocalValue(data.studentRegistrationCloseAt),
        registrationCloseAt: isoToDatetimeLocalValue(data.registrationCloseAt),
      });
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
            <dt className="text-xs uppercase text-slate-500">Exam board</dt>
            <dd className="text-sm font-medium text-slate-900">
              {window.examBoard.code} — {window.examBoard.name}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Exam series</dt>
            <dd className="text-sm font-medium text-slate-900">
              {window.examSeries.name} ({window.examSeries.year})
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
          <form onSubmit={handleSave} className="space-y-4">
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Window name</span>
              <input
                required
                value={window.title}
                onChange={(e) => setWindow({ ...window, title: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm sm:col-span-2">
                <span className="mb-1 block text-slate-600">
                  Student registration open at
                  <span className="ml-1 font-normal text-slate-400">(Normal fee stage start)</span>
                </span>
                <input
                  required
                  type="datetime-local"
                  value={window.studentRegistrationOpenAt}
                  onChange={(e) => setWindow({ ...window, studentRegistrationOpenAt: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="mb-1 block text-slate-600">
                  Student registration close at
                  <span className="ml-1 font-normal text-slate-400">(Normal fee stage end)</span>
                </span>
                <input
                  required
                  type="datetime-local"
                  value={window.studentRegistrationCloseAt}
                  onChange={(e) => setWindow({ ...window, studentRegistrationCloseAt: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="mb-1 block text-slate-600">
                  Registration close at
                  <span className="ml-1 font-normal text-slate-400">(High Late Entry end)</span>
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

            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Status</span>
              <select
                value={window.status}
                onChange={(e) => setWindow({ ...window, status: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:max-w-xs"
              >
                <option value="DRAFT">Draft</option>
                <option value="OPEN">Open</option>
                <option value="CLOSED">Closed</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </label>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-slate-700">Registration permissions</legend>
              {(
                [
                  ["studentSelfRegistrationEnabled", "Student self-registration enabled"],
                  ["eoAssistedRegistrationEnabled", "Exam Officer assisted registration enabled"],
                  ["officeOnlyRegistrationEnabled", "Office-only registration enabled"],
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
              disabled={saving}
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
            <li>Office-only registration: {window.officeOnlyRegistrationEnabled ? "Enabled" : "Disabled"}</li>
            <li>Post-lock adjustment: {window.postLockAdjustmentEnabled ? "Enabled" : "Disabled"}</li>
          </ul>
        </Card>
      )}
    </div>
  );
}
