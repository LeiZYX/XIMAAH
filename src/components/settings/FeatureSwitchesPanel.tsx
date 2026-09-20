"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { SettingsSubnav } from "@/components/settings/SettingsSubnav";
import { PageHeader } from "@/components/ui/PageHeader";

interface FeatureSettings {
  studentLoginEnabled: boolean;
  updatedAt: string | null;
  updatedByName: string | null;
}

const primaryButtonClass =
  "rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50";

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export function FeatureSwitchesPanel() {
  const [settings, setSettings] = useState<FeatureSettings | null>(null);
  const [draftEnabled, setDraftEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/settings/feature-switches");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Failed to load settings");
      }
      const next = data.settings as FeatureSettings;
      setSettings(next);
      setDraftEnabled(next.studentLoginEnabled);
    } catch (loadError) {
      setSettings(null);
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

    if (!draftEnabled && settings.studentLoginEnabled) {
      const confirmed = window.confirm(
        [
          "Turn off student login?",
          "",
          "Students will not be able to sign in or reset passwords.",
          "Students who are already signed in will be signed out on their next request.",
          "Staff accounts are not affected.",
        ].join("\n"),
      );
      if (!confirmed) return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/settings/feature-switches", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentLoginEnabled: draftEnabled }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Failed to save");
      }
      const next = data.settings as FeatureSettings;
      setSettings(next);
      setDraftEnabled(next.studentLoginEnabled);
      setMessage(
        next.studentLoginEnabled
          ? "Student login is enabled."
          : "Student login is turned off.",
      );
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <SettingsSubnav />
      <PageHeader
        title="Feature switches"
        description="Turn product-wide options on or off without a deploy. Only Admin can change these."
      />

      {loading ? <p className="text-sm text-slate-500">Loading…</p> : null}
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

      {settings ? (
        <form onSubmit={(e) => void handleSave(e)} className="max-w-xl space-y-6">
          <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4">
            <input
              type="checkbox"
              className="mt-1"
              checked={draftEnabled}
              onChange={(e) => setDraftEnabled(e.target.checked)}
            />
            <span>
              <span className="block text-sm font-medium text-slate-900">Allow student login</span>
              <span className="mt-1 block text-sm text-slate-600">
                When off, students cannot sign in or use forgot password. Existing student sessions
                end on the next page or API request. Admin, Exam Officer, Finance, and Teacher are
                not affected.
              </span>
            </span>
          </label>

          <p className="text-xs text-slate-500">
            Last updated: {formatDateTime(settings.updatedAt)}
            {settings.updatedByName ? ` · ${settings.updatedByName}` : ""}
          </p>

          <button type="submit" disabled={saving || loading} className={primaryButtonClass}>
            {saving ? "Saving…" : "Save"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
