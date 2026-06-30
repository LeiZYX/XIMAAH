"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { UsersSubnav } from "@/components/users/UsersSubnav";
import { USERS_MODULE_DESCRIPTION } from "@/lib/navigation/module-descriptions";

interface PasswordSettings {
  smtpConfigured: boolean;
  smtpHost: string | null;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string | null;
  mailFrom: string | null;
  hasStoredPassword: boolean;
  passwordResetExpiresMinutes: number;
  appUrl: string | null;
}

interface SettingsFormState {
  smtpHost: string;
  smtpPort: string;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassword: string;
  mailFrom: string;
  passwordResetExpiresMinutes: string;
  appUrl: string;
}

const inputClass = "w-full rounded border border-slate-300 px-3 py-2 text-sm";
const buttonClass =
  "rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50";
const primaryButtonClass =
  "rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50";

function settingsToForm(settings: PasswordSettings): SettingsFormState {
  return {
    smtpHost: settings.smtpHost ?? "",
    smtpPort: String(settings.smtpPort),
    smtpSecure: settings.smtpSecure,
    smtpUser: settings.smtpUser ?? "",
    smtpPassword: "",
    mailFrom: settings.mailFrom ?? "",
    passwordResetExpiresMinutes: String(settings.passwordResetExpiresMinutes),
    appUrl: settings.appUrl ?? "",
  };
}

export function PasswordSettingsPanel() {
  const [settings, setSettings] = useState<PasswordSettings | null>(null);
  const [form, setForm] = useState<SettingsFormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadSettings() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/users/password-settings");
      const text = await response.text();
      const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Failed to load settings");
      }
      const next = data as unknown as PasswordSettings;
      setSettings(next);
      setForm(settingsToForm(next));
    } catch (loadError) {
      setSettings(null);
      setForm(null);
      setError(loadError instanceof Error ? loadError.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSettings();
  }, []);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!form) return;

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/users/password-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          smtpHost: form.smtpHost.trim() || null,
          smtpPort: Number(form.smtpPort),
          smtpSecure: form.smtpSecure,
          smtpUser: form.smtpUser.trim() || null,
          smtpPassword: form.smtpPassword.trim() || null,
          mailFrom: form.mailFrom.trim() || null,
          passwordResetExpiresMinutes: Number(form.passwordResetExpiresMinutes),
          appUrl: form.appUrl.trim() || null,
        }),
      });
      const text = await response.text();
      const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Save failed");
      }
      const next = data as unknown as PasswordSettings;
      setSettings(next);
      setForm(settingsToForm(next));
      setMessage("SMTP settings saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function sendTestEmail(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/users/password-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testEmail: testEmail.trim() }),
      });
      const text = await response.text();
      const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Test email failed");
      }
      setMessage(`Test email sent to ${testEmail.trim()}.`);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Test email failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <UsersSubnav />
      <PageHeader
        title="Password & Email Settings"
        description={`${USERS_MODULE_DESCRIPTION} Configure SMTP for password reset emails. Settings are stored in the database; leave password blank to keep the current value.`}
      />

      <div className="space-y-6 border border-slate-200 p-4">
        {loading ? (
          <p className="text-sm text-slate-500">Loading SMTP settings...</p>
        ) : form ? (
          <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-slate-700">
                Status:{" "}
                {settings?.smtpConfigured ? (
                  <span className="text-green-700">Configured</span>
                ) : (
                  <span className="text-red-700">Not configured</span>
                )}
              </p>
              <button type="button" onClick={() => void loadSettings()} className={buttonClass}>
                Reload
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm text-slate-700">
                SMTP host
                <input
                  value={form.smtpHost}
                  onChange={(e) => setForm((prev) => prev && { ...prev, smtpHost: e.target.value })}
                  className={`mt-1 ${inputClass}`}
                  placeholder="smtp.example.com"
                />
              </label>
              <label className="block text-sm text-slate-700">
                SMTP port
                <input
                  type="number"
                  min={1}
                  value={form.smtpPort}
                  onChange={(e) => setForm((prev) => prev && { ...prev, smtpPort: e.target.value })}
                  className={`mt-1 ${inputClass}`}
                />
              </label>
              <label className="block text-sm text-slate-700">
                SMTP user
                <input
                  value={form.smtpUser}
                  onChange={(e) => setForm((prev) => prev && { ...prev, smtpUser: e.target.value })}
                  className={`mt-1 ${inputClass}`}
                />
              </label>
              <label className="block text-sm text-slate-700">
                SMTP password
                <input
                  type="password"
                  value={form.smtpPassword}
                  onChange={(e) =>
                    setForm((prev) => prev && { ...prev, smtpPassword: e.target.value })
                  }
                  className={`mt-1 ${inputClass}`}
                  placeholder={
                    settings?.hasStoredPassword ? "Leave blank to keep current password" : ""
                  }
                />
              </label>
              <label className="block text-sm text-slate-700">
                From address
                <input
                  type="email"
                  value={form.mailFrom}
                  onChange={(e) => setForm((prev) => prev && { ...prev, mailFrom: e.target.value })}
                  className={`mt-1 ${inputClass}`}
                />
              </label>
              <label className="block text-sm text-slate-700">
                Reset link expiry (minutes)
                <input
                  type="number"
                  min={1}
                  value={form.passwordResetExpiresMinutes}
                  onChange={(e) =>
                    setForm((prev) =>
                      prev ? { ...prev, passwordResetExpiresMinutes: e.target.value } : prev,
                    )
                  }
                  className={`mt-1 ${inputClass}`}
                />
              </label>
              <label className="block text-sm text-slate-700 sm:col-span-2">
                App URL
                <input
                  value={form.appUrl}
                  onChange={(e) => setForm((prev) => prev && { ...prev, appUrl: e.target.value })}
                  className={`mt-1 ${inputClass}`}
                  placeholder="https://assessment.example.com"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.smtpSecure}
                  onChange={(e) =>
                    setForm((prev) => prev && { ...prev, smtpSecure: e.target.checked })
                  }
                />
                Use TLS/SSL (secure connection)
              </label>
            </div>

            <button type="submit" disabled={saving} className={primaryButtonClass}>
              {saving ? "Saving..." : "Save settings"}
            </button>
          </form>
        ) : null}

        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        {message ? <p className="text-sm text-green-700">{message}</p> : null}

        <form onSubmit={(e) => void sendTestEmail(e)} className="space-y-3 border-t border-slate-200 pt-4">
          <h2 className="text-sm font-semibold text-slate-900">Send test email</h2>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm text-slate-700">
              Recipient
              <input
                type="email"
                required
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                className={inputClass}
                placeholder="admin@school.edu"
                disabled={!settings?.smtpConfigured || sending}
              />
            </label>
            <button
              type="submit"
              disabled={!settings?.smtpConfigured || sending}
              className={primaryButtonClass}
            >
              {sending ? "Sending..." : "Send test"}
            </button>
          </div>
          {!settings?.smtpConfigured ? (
            <p className="text-sm text-slate-600">Save SMTP settings before sending a test email.</p>
          ) : null}
        </form>
      </div>
    </div>
  );
}
