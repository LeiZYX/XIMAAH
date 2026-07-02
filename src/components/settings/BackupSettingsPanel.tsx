"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { SettingsSubnav } from "@/components/settings/SettingsSubnav";
import { PageHeader } from "@/components/ui/PageHeader";

interface BackupSettings {
  enabled: boolean;
  frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  backupTime: string;
  backupDirectory: string;
  retentionDays: number;
  backupType: "DATABASE_ONLY" | "DATABASE_AND_UPLOADS";
  updatedAt: string | null;
}

interface BackupJobRow {
  id: string;
  backupType: string;
  status: string;
  fileName: string | null;
  fileSizeBytes: number | null;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  triggeredBy: string;
  triggeredByUser: { id: string; name: string } | null;
  createdAt: string;
}

const inputClass = "w-full rounded border border-slate-300 px-3 py-2 text-sm";
const buttonClass =
  "rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50";
const primaryButtonClass =
  "rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50";

function formatBytes(bytes: number | null) {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export function BackupSettingsPanel() {
  const [settings, setSettings] = useState<BackupSettings | null>(null);
  const [jobs, setJobs] = useState<BackupJobRow[]>([]);
  const [scheduledNote, setScheduledNote] = useState("");
  const [restoreNote, setRestoreNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/settings/backup");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Failed to load settings");
      }
      setSettings(data.settings as BackupSettings);
      setJobs(Array.isArray(data.jobs) ? (data.jobs as BackupJobRow[]) : []);
      setScheduledNote(typeof data.scheduledBackupNote === "string" ? data.scheduledBackupNote : "");
      setRestoreNote(typeof data.restoreNote === "string" ? data.restoreNote : "");
    } catch (loadError) {
      setSettings(null);
      setJobs([]);
      setError(loadError instanceof Error ? loadError.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!settings) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/admin/settings/backup", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Save failed");
      }
      setSettings(data.settings as BackupSettings);
      setMessage("Backup settings saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleRunBackup() {
    setRunning(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/admin/settings/backup/run", { method: "POST" });
      const data = await response.json();
      if (data.job) {
        setJobs((prev) => {
          const job = data.job as BackupJobRow;
          const without = prev.filter((row) => row.id !== job.id);
          return [job, ...without];
        });
      }
      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Backup failed");
      }
      setMessage(typeof data.message === "string" ? data.message : "Backup completed.");
      await load();
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Backup failed");
      await load();
    } finally {
      setRunning(false);
    }
  }

  async function handleDeleteJob(job: BackupJobRow) {
    if (
      !window.confirm(
        `Delete backup file "${job.fileName ?? job.id}"? This cannot be undone.`,
      )
    ) {
      return;
    }
    setError(null);
    setMessage(null);
    const response = await fetch(`/api/admin/settings/backup/jobs/${job.id}`, {
      method: "DELETE",
    });
    const data = await response.json();
    if (!response.ok) {
      setError(typeof data.error === "string" ? data.error : "Delete failed");
      return;
    }
    setMessage("Backup file deleted.");
    await load();
  }

  if (loading && !settings) {
    return <p className="text-sm text-slate-500">Loading backup settings...</p>;
  }

  if (!settings) {
    return <p className="text-sm text-red-700">{error ?? "Could not load backup settings."}</p>;
  }

  return (
    <div className="space-y-6">
      <SettingsSubnav />
      <PageHeader
        title="Backup Settings"
        description="Configure automated database backups, retention, and download backup history."
        action={
          <button
            type="button"
            onClick={() => void handleRunBackup()}
            disabled={running}
            className={primaryButtonClass}
          >
            {running ? "Running backup..." : "Run Backup Now"}
          </button>
        }
      />

      {message ? <p className="text-sm text-green-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <form onSubmit={(e) => void handleSave(e)} className="space-y-4 border border-slate-200 p-4">
        <h2 className="text-lg font-semibold text-slate-900">Configuration</h2>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
          />
          Backup enabled (for scheduled runs)
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm text-slate-700">
            Backup frequency
            <select
              value={settings.frequency}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  frequency: e.target.value as BackupSettings["frequency"],
                })
              }
              className={`mt-1 ${inputClass}`}
            >
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
          </label>

          <label className="block text-sm text-slate-700">
            Backup time (HH:mm)
            <input
              type="time"
              value={settings.backupTime}
              onChange={(e) => setSettings({ ...settings, backupTime: e.target.value })}
              className={`mt-1 ${inputClass}`}
              required
            />
          </label>

          <label className="block text-sm text-slate-700 sm:col-span-2">
            Backup directory
            <input
              type="text"
              value={settings.backupDirectory}
              onChange={(e) => setSettings({ ...settings, backupDirectory: e.target.value })}
              className={`mt-1 ${inputClass} font-mono`}
              required
            />
            <span className="mt-1 block text-xs text-slate-500">
              Must be under /var/backups/ (or backups/mysql in development).
            </span>
          </label>

          <label className="block text-sm text-slate-700">
            Retention days
            <input
              type="number"
              min={1}
              max={3650}
              value={settings.retentionDays}
              onChange={(e) =>
                setSettings({ ...settings, retentionDays: Number(e.target.value) })
              }
              className={`mt-1 ${inputClass}`}
              required
            />
          </label>

          <label className="block text-sm text-slate-700">
            Backup type
            <select
              value={settings.backupType}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  backupType: e.target.value as BackupSettings["backupType"],
                })
              }
              className={`mt-1 ${inputClass}`}
            >
              <option value="DATABASE_ONLY">Database only</option>
              <option value="DATABASE_AND_UPLOADS" disabled>
                Database + uploads (coming later)
              </option>
            </select>
          </label>
        </div>

        <div className="flex gap-2">
          <button type="submit" disabled={saving} className={primaryButtonClass}>
            {saving ? "Saving..." : "Save settings"}
          </button>
        </div>
      </form>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-medium">Scheduled backups</p>
        <p className="mt-1">{scheduledNote}</p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <p className="font-medium">Restore</p>
        <p className="mt-1">{restoreNote}</p>
      </div>

      <div className="space-y-3 border border-slate-200 p-4">
        <h2 className="text-lg font-semibold text-slate-900">Backup history</h2>
        {jobs.length === 0 ? (
          <p className="text-sm text-slate-500">No backup jobs yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse border border-slate-200 text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs uppercase text-slate-600">
                  <th className="border border-slate-200 px-3 py-2">File name</th>
                  <th className="border border-slate-200 px-3 py-2">Type</th>
                  <th className="border border-slate-200 px-3 py-2">Status</th>
                  <th className="border border-slate-200 px-3 py-2">Size</th>
                  <th className="border border-slate-200 px-3 py-2">Triggered by</th>
                  <th className="border border-slate-200 px-3 py-2">Started</th>
                  <th className="border border-slate-200 px-3 py-2">Completed</th>
                  <th className="border border-slate-200 px-3 py-2">Error</th>
                  <th className="border border-slate-200 px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td className="border border-slate-200 px-3 py-2 font-mono text-xs">
                      {job.fileName ?? "—"}
                    </td>
                    <td className="border border-slate-200 px-3 py-2">{job.backupType}</td>
                    <td className="border border-slate-200 px-3 py-2">{job.status}</td>
                    <td className="border border-slate-200 px-3 py-2">
                      {formatBytes(job.fileSizeBytes)}
                    </td>
                    <td className="border border-slate-200 px-3 py-2">
                      {job.triggeredBy}
                      {job.triggeredByUser ? ` (${job.triggeredByUser.name})` : ""}
                    </td>
                    <td className="border border-slate-200 px-3 py-2">
                      {formatDateTime(job.startedAt)}
                    </td>
                    <td className="border border-slate-200 px-3 py-2">
                      {formatDateTime(job.completedAt)}
                    </td>
                    <td className="border border-slate-200 px-3 py-2 text-xs text-red-700">
                      {job.errorMessage ?? "—"}
                    </td>
                    <td className="border border-slate-200 px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        {job.status === "SUCCESS" && job.fileName ? (
                          <a
                            href={`/api/admin/settings/backup/jobs/${job.id}/download`}
                            className="text-indigo-700 hover:underline"
                          >
                            Download
                          </a>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void handleDeleteJob(job)}
                          className="text-red-700 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
