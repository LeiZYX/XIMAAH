"use client";

import { useState, type ReactNode } from "react";

function IconActionButton({
  label,
  onClick,
  disabled,
  tone = "neutral",
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "neutral" | "primary" | "warning" | "danger" | "success";
  children: ReactNode;
}) {
  const toneClass =
    tone === "primary"
      ? "text-indigo-700 ring-indigo-200 hover:bg-indigo-50"
      : tone === "warning"
        ? "text-amber-800 ring-amber-200 hover:bg-amber-50"
        : tone === "danger"
          ? "text-red-700 ring-red-200 hover:bg-red-50"
          : tone === "success"
            ? "text-green-800 ring-green-200 hover:bg-green-50"
            : "text-slate-700 ring-slate-200 hover:bg-slate-50";

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset disabled:opacity-50 ${toneClass}`}
    >
      {children}
    </button>
  );
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function CandidateLifecycleActions({
  candidateId,
  apiPath,
  status,
  canArchive,
  canDelete,
  iconOnly = false,
  onChanged,
  onDeleted,
}: {
  candidateId: string;
  apiPath: string;
  status: string;
  canArchive: boolean;
  canDelete: boolean;
  iconOnly?: boolean;
  onChanged?: () => void;
  onDeleted?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function archive() {
    const confirmed = window.confirm(
      "Archiving this student will disable login and hide the student from active lists, but historical records will remain available.",
    );
    if (!confirmed) return;
    setBusy(true);
    setError(null);
    const response = await fetch(`${apiPath}/${candidateId}/archive`, { method: "POST" });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(typeof data.error === "string" ? data.error : "Archive failed");
      return;
    }
    onChanged?.();
  }

  async function reactivate() {
    setBusy(true);
    setError(null);
    const response = await fetch(`${apiPath}/${candidateId}/reactivate`, { method: "POST" });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(typeof data.error === "string" ? data.error : "Reactivate failed");
      return;
    }
    onChanged?.();
  }

  async function deleteCandidate() {
    setBusy(true);
    setError(null);
    const check = await fetch(`${apiPath}/${candidateId}/delete-check`);
    const checkData = await check.json();
    if (!check.ok) {
      setBusy(false);
      setError(typeof checkData.error === "string" ? checkData.error : "Could not verify delete");
      return;
    }
    if (!checkData.canDelete) {
      setBusy(false);
      setError(
        "This student has historical records and cannot be deleted. You may archive this student instead.",
      );
      return;
    }
    const confirmed = window.confirm(
      "This action permanently deletes the student record and cannot be undone.",
    );
    if (!confirmed) {
      setBusy(false);
      return;
    }
    const response = await fetch(`${apiPath}/${candidateId}/delete`, { method: "DELETE" });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(typeof data.error === "string" ? data.error : "Delete failed");
      return;
    }
    onDeleted?.();
  }

  if (!canArchive && !canDelete) return null;

  if (iconOnly) {
    return (
      <>
        {canArchive && status !== "INACTIVE" ? (
          <IconActionButton label="Archive" disabled={busy} tone="warning" onClick={() => void archive()}>
            <Icon>
              <rect x="3" y="5" width="18" height="4" rx="1" />
              <path d="M5 9v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9" />
              <path d="M10 13h4" />
            </Icon>
          </IconActionButton>
        ) : null}
        {canArchive && status === "INACTIVE" ? (
          <IconActionButton label="Reactivate" disabled={busy} tone="success" onClick={() => void reactivate()}>
            <Icon>
              <path d="M3 12a9 9 0 1 0 3-6.7" />
              <path d="M3 4v5h5" />
            </Icon>
          </IconActionButton>
        ) : null}
        {canDelete ? (
          <IconActionButton
            label="Delete permanently"
            disabled={busy}
            tone="danger"
            onClick={() => void deleteCandidate()}
          >
            <Icon>
              <path d="M4 7h16" />
              <path d="M10 11v6M14 11v6" />
              <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
              <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </Icon>
          </IconActionButton>
        ) : null}
        {error ? (
          <span className="basis-full text-xs text-red-700" title={error}>
            {error}
          </span>
        ) : null}
      </>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {canArchive && status !== "INACTIVE" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void archive()}
            className="rounded-lg border border-amber-300 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-50"
          >
            Archive
          </button>
        ) : null}
        {canArchive && status === "INACTIVE" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void reactivate()}
            className="rounded-lg border border-green-300 px-3 py-2 text-sm font-medium text-green-800 hover:bg-green-50 disabled:opacity-50"
          >
            Reactivate
          </button>
        ) : null}
        {canDelete ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void deleteCandidate()}
            className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-50 disabled:opacity-50"
          >
            Delete permanently
          </button>
        ) : null}
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
