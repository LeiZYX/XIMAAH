"use client";

import { FormEvent, useState } from "react";

const inputClass = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";

export function SetPasswordModal({
  open,
  userLabel,
  onClose,
  onSubmit,
}: {
  open: boolean;
  userLabel: string;
  onClose: () => void;
  onSubmit: (password: string, confirmPassword: string) => Promise<string | null>;
}) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const result = await onSubmit(password, confirmPassword);
    setSaving(false);
    if (result) {
      setError(result);
      return;
    }
    setPassword("");
    setConfirmPassword("");
    onClose();
  }

  function handleClose() {
    setPassword("");
    setConfirmPassword("");
    setError(null);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-lg border border-slate-300 bg-white p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-slate-900">Set password</h2>
        <p className="mt-1 text-sm text-slate-600">
          Set a new password for {userLabel}. The user can log in immediately without being forced
          to change it.
        </p>
        <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-4">
          <label className="block text-sm text-slate-700">
            New password
            <input
              required
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`mt-1 ${inputClass}`}
            />
          </label>
          <label className="block text-sm text-slate-700">
            Confirm password
            <input
              required
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={`mt-1 ${inputClass}`}
            />
          </label>
          <p className="text-xs text-slate-500">
            Minimum 8 characters, at least one letter and one number.
          </p>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={saving}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
