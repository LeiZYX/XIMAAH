"use client";

import { useState } from "react";

export function CandidateLifecycleActions({
  candidateId,
  apiPath,
  status,
  canArchive,
  canDelete,
  onChanged,
  onDeleted,
}: {
  candidateId: string;
  apiPath: string;
  status: string;
  canArchive: boolean;
  canDelete: boolean;
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
