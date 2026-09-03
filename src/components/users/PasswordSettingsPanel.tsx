"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { UsersSubnav } from "@/components/users/UsersSubnav";
import { USERS_MODULE_DESCRIPTION } from "@/lib/navigation/module-descriptions";
import {
  ALIYUN_MAIL_SMTP_HOST,
  ALIYUN_MAIL_SMTP_PORTS,
  describeSmtpPort,
  normalizeSmtpSecure,
} from "@/lib/mail/smtp-ports";

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

const ALIYUN_DOC_URL =
  "https://help.aliyun.com/zh/document_detail/36687.html";

function settingsToForm(settings: PasswordSettings): SettingsFormState {
  const port = settings.smtpPort || 465;
  return {
    smtpHost: settings.smtpHost ?? "",
    smtpPort: String(port),
    smtpSecure: normalizeSmtpSecure(port, settings.smtpSecure),
    smtpUser: settings.smtpUser ?? "",
    smtpPassword: "",
    mailFrom: settings.mailFrom ?? "",
    passwordResetExpiresMinutes: String(settings.passwordResetExpiresMinutes),
    appUrl: settings.appUrl ?? "",
  };
}

function applyAliyunMailPreset(prev: SettingsFormState): SettingsFormState {
  return {
    ...prev,
    smtpHost: ALIYUN_MAIL_SMTP_HOST,
    smtpPort: "465",
    smtpSecure: true,
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

  function updatePort(portValue: string) {
    setForm((prev) => {
      if (!prev) return prev;
      const port = Number(portValue);
      return {
        ...prev,
        smtpPort: portValue,
        smtpSecure: Number.isFinite(port) ? normalizeSmtpSecure(port, prev.smtpSecure) : prev.smtpSecure,
      };
    });
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!form) return;

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const port = Number(form.smtpPort);
      const response = await fetch("/api/admin/users/password-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          smtpHost: form.smtpHost.trim() || null,
          smtpPort: port,
          smtpSecure: normalizeSmtpSecure(port, form.smtpSecure),
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

  const selectedPort = form ? Number(form.smtpPort) : NaN;

  return (
    <div className="space-y-4">
      <UsersSubnav />
      <PageHeader
        title="Password & Email Settings"
        description={`${USERS_MODULE_DESCRIPTION} Configure Aliyun Mail (阿里邮箱) SMTP for system notification emails (registration lock, fee statements) and password reset. Settings are stored in the database; leave password blank to keep the current value.`}
      />

      <div className="space-y-6 border border-slate-200 p-4">
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
          <p className="font-medium">Aliyun Mail SMTP (system notifications &amp; password reset)</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sky-900">
            <li>
              Host: <code className="rounded bg-white px-1">{ALIYUN_MAIL_SMTP_HOST}</code>{" "}
              (or <code className="rounded bg-white px-1">smtp.your-domain.com</code> after CNAME)
            </li>
            <li>
              Ports: <strong>465 + SSL</strong> (recommended), or <strong>80</strong> / <strong>25</strong>{" "}
              without SSL. Cloud ECS often blocks port 25 — prefer 465 or 80.
            </li>
            <li>
              SMTP user: full mailbox address (e.g. <code className="rounded bg-white px-1">noreply@school.edu.cn</code>)
            </li>
            <li>
              SMTP password: mailbox login password, or the client security password if that feature is enabled
            </li>
            <li>Enable SMTP for the mailbox in Aliyun Mail before testing</li>
            <li>From address should be the same mailbox (or an allowed alias)</li>
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className={buttonClass}
              onClick={() => setForm((prev) => (prev ? applyAliyunMailPreset(prev) : prev))}
            >
              Fill Aliyun Mail defaults (465 + SSL)
            </button>
            <a
              href={ALIYUN_DOC_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-slate-50"
            >
              Aliyun Mail SMTP docs
            </a>
          </div>
        </div>

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
                {!settings?.smtpConfigured ? (
                  <span className="ml-2 text-slate-500">
                    (needs host, from, SMTP user, and password)
                  </span>
                ) : null}
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
                  placeholder={ALIYUN_MAIL_SMTP_HOST}
                />
              </label>
              <label className="block text-sm text-slate-700">
                SMTP port
                <select
                  value={
                    ALIYUN_MAIL_SMTP_PORTS.includes(selectedPort as (typeof ALIYUN_MAIL_SMTP_PORTS)[number])
                      ? String(selectedPort)
                      : form.smtpPort
                  }
                  onChange={(e) => updatePort(e.target.value)}
                  className={`mt-1 ${inputClass}`}
                >
                  {ALIYUN_MAIL_SMTP_PORTS.map((port) => (
                    <option key={port} value={port}>
                      {port} — {describeSmtpPort(port)}
                    </option>
                  ))}
                  {!ALIYUN_MAIL_SMTP_PORTS.includes(selectedPort as (typeof ALIYUN_MAIL_SMTP_PORTS)[number]) &&
                  form.smtpPort ? (
                    <option value={form.smtpPort}>
                      {form.smtpPort} — custom / current
                    </option>
                  ) : null}
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  {Number.isFinite(selectedPort) ? describeSmtpPort(selectedPort) : null}
                </p>
              </label>
              <label className="block text-sm text-slate-700">
                SMTP user (full email)
                <input
                  value={form.smtpUser}
                  onChange={(e) => setForm((prev) => prev && { ...prev, smtpUser: e.target.value })}
                  className={`mt-1 ${inputClass}`}
                  placeholder="noreply@your-school.edu.cn"
                />
              </label>
              <label className="block text-sm text-slate-700">
                SMTP password / security password
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
                  placeholder="noreply@your-school.edu.cn"
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
                  placeholder="https://exam.shssip-iedu.cn"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.smtpSecure}
                  disabled={selectedPort === 465}
                  onChange={(e) =>
                    setForm((prev) => prev && { ...prev, smtpSecure: e.target.checked })
                  }
                />
                Use SSL (required for port 465; leave unchecked for ports 80 / 25)
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
            <p className="text-sm text-slate-600">
              Save host, from address, SMTP user, and password before sending a test email.
            </p>
          ) : null}
        </form>
      </div>
    </div>
  );
}
