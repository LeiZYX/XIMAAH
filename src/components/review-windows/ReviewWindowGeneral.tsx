"use client";

import { FormEvent, useEffect, useState } from "react";
import { ReviewWindowDetailShell } from "@/components/review-windows/ReviewWindowDetailShell";
import { datetimeLocalValueToIso, isoToDatetimeLocalValue } from "@/lib/datetime-local";
import { REVIEW_WINDOW_STATUS_OPTIONS } from "@/lib/post-results/constants";

interface ReviewWindowGeneralProps {
  windowId: string;
  basePath: "/admin/review-windows" | "/exam-office/review-windows";
  feeStatementsBasePath: "/admin/fee-statements" | "/exam-office/fee-statements";
}

export function ReviewWindowGeneral({
  windowId,
  basePath,
  feeStatementsBasePath,
}: ReviewWindowGeneralProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("DRAFT");
  const [openAt, setOpenAt] = useState("");
  const [closeAt, setCloseAt] = useState("");
  const [resultsReleaseDate, setResultsReleaseDate] = useState("");
  const [notes, setNotes] = useState("");
  const [boardName, setBoardName] = useState("");
  const [seriesLabel, setSeriesLabel] = useState("");

  useEffect(() => {
    fetch(`/api/review-windows/${windowId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        setTitle(data.title);
        setStatus(data.status);
        setOpenAt(isoToDatetimeLocalValue(data.openAt));
        setCloseAt(isoToDatetimeLocalValue(data.closeAt));
        setResultsReleaseDate(
          data.resultsReleaseDate ? isoToDatetimeLocalValue(data.resultsReleaseDate) : "",
        );
        setNotes(data.notes ?? "");
        setBoardName(data.examBoard?.name ?? "");
        setSeriesLabel(
          data.examSeries ? `${data.examSeries.name} (${data.examSeries.year})` : "",
        );
        setLocked(data.status === "LOCKED");
      })
      .finally(() => setLoading(false));
  }, [windowId]);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/review-windows/${windowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          status,
          openAt: datetimeLocalValueToIso(openAt),
          closeAt: datetimeLocalValueToIso(closeAt),
          resultsReleaseDate: resultsReleaseDate
            ? datetimeLocalValueToIso(resultsReleaseDate)
            : null,
          notes: notes || null,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Failed to save");
      }

      const updated = await response.json();
      setLocked(updated.status === "LOCKED");
      setMessage("Review window saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ReviewWindowDetailShell
      windowId={windowId}
      basePath={basePath}
      feeStatementsBasePath={feeStatementsBasePath}
    >
      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <form onSubmit={handleSave} className="max-w-3xl space-y-4 border border-slate-200 bg-white p-4">
          {error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              {message}
            </p>
          ) : null}
          {locked ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              This review window is locked and cannot be edited.
            </p>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm md:col-span-2">
              <span className="mb-1 block font-medium text-slate-700">Title</span>
              <input
                required
                disabled={locked}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full border border-slate-300 px-3 py-2 disabled:bg-slate-50"
              />
            </label>
            <div className="text-sm">
              <p className="mb-1 font-medium text-slate-700">Exam board</p>
              <p className="text-slate-900">{boardName || "—"}</p>
            </div>
            <div className="text-sm">
              <p className="mb-1 font-medium text-slate-700">Exam series</p>
              <p className="text-slate-900">{seriesLabel || "—"}</p>
            </div>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Open at</span>
              <input
                required
                disabled={locked}
                type="datetime-local"
                value={openAt}
                onChange={(e) => setOpenAt(e.target.value)}
                className="w-full border border-slate-300 px-3 py-2 disabled:bg-slate-50"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Close at</span>
              <input
                required
                disabled={locked}
                type="datetime-local"
                value={closeAt}
                onChange={(e) => setCloseAt(e.target.value)}
                className="w-full border border-slate-300 px-3 py-2 disabled:bg-slate-50"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Results release date</span>
              <input
                disabled={locked}
                type="datetime-local"
                value={resultsReleaseDate}
                onChange={(e) => setResultsReleaseDate(e.target.value)}
                className="w-full border border-slate-300 px-3 py-2 disabled:bg-slate-50"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Status</span>
              <select
                disabled={locked}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full border border-slate-300 px-3 py-2 disabled:bg-slate-50"
              >
                {REVIEW_WINDOW_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm md:col-span-2">
              <span className="mb-1 block font-medium text-slate-700">Notes</span>
              <textarea
                disabled={locked}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full border border-slate-300 px-3 py-2 disabled:bg-slate-50"
              />
            </label>
          </div>

          {!locked ? (
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          ) : null}
        </form>
      )}
    </ReviewWindowDetailShell>
  );
}
