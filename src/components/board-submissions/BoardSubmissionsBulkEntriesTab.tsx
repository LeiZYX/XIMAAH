"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { BoardSubmissionWindowSummary } from "@/lib/board-submissions/types";
import type { BulkEntriesPreview } from "@/lib/board-submissions/bulk-entries/types";
import { Card } from "@/components/ui/Card";

export function BoardSubmissionsBulkEntriesTab({
  summary,
  basePath,
  onSubmitted,
}: {
  summary: BoardSubmissionWindowSummary;
  basePath: "/admin" | "/exam-office";
  onSubmitted?: () => void;
}) {
  const registrationWindowId = summary.window.id;
  const [preview, setPreview] = useState<BulkEntriesPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/board-submissions/bulk-entries/preview?registrationWindowId=${encodeURIComponent(registrationWindowId)}`,
      );
      const data = (await response.json()) as BulkEntriesPreview & { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load bulk entries preview");
      }
      setPreview(data);
    } catch (err) {
      setPreview(null);
      setError(err instanceof Error ? err.message : "Failed to load bulk entries preview");
    } finally {
      setLoading(false);
    }
  }, [registrationWindowId]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  async function markSubmitted() {
    if (!preview?.canSubmit) return;
    const confirmed = window.confirm(
      `Mark Bulk Entries as submitted to the exam board?\n\nThis will create baseline v${(summary.baseline.latest?.version ?? 0) + 1} for ${preview.candidateCount} candidate(s).`,
    );
    if (!confirmed) return;

    setSubmitting(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/board-submissions/bulk-entries/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationWindowId }),
      });
      const data = (await response.json()) as { error?: string; baseline?: { version: number } };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to mark as submitted");
      }
      setMessage(`Baseline v${data.baseline?.version ?? ""} created.`);
      onSubmitted?.();
      await loadPreview();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark as submitted");
    } finally {
      setSubmitting(false);
    }
  }

  const exportParts = preview?.fileCount ?? 1;

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Bulk Entries</h2>
          <p className="mt-1 text-sm text-slate-600">
            Export the official Bulk Entries layout for the first submission to the exam board.
            Candidates with more than 32 specifications are split across multiple files.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: exportParts }, (_, index) => {
            const part = index + 1;
            const disabled = !preview?.canExport;
            return (
              <a
                key={part}
                href={
                  disabled
                    ? undefined
                    : `/api/board-submissions/bulk-entries/export?registrationWindowId=${encodeURIComponent(registrationWindowId)}&part=${part}`
                }
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  disabled
                    ? "cursor-not-allowed bg-slate-100 text-slate-400"
                    : "bg-white text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-50"
                }`}
                aria-disabled={disabled}
                onClick={(event) => {
                  if (disabled) event.preventDefault();
                }}
              >
                Download{exportParts > 1 ? ` part ${part}` : ""}
              </a>
            );
          })}
          <button
            type="button"
            onClick={() => void markSubmitted()}
            disabled={!preview?.canSubmit || submitting}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Mark as submitted"}
          </button>
        </div>
      </div>

      {loading ? <p className="text-sm text-slate-600">Loading export preview…</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

      {preview && preview.blockingIssues.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">Resolve these issues before export or submit:</p>
          <ul className="mt-2 list-disc pl-5">
            {preview.blockingIssues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
          {summary.registration.missingIdentityCount > 0 ? (
            <p className="mt-2">
              <Link href={`${basePath}/candidates/board-registration`} className="font-medium underline">
                Open Board Registration
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}

      {preview ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <p className="text-slate-500">Candidates</p>
              <p className="text-lg font-semibold text-slate-900">{preview.candidateCount}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <p className="text-slate-500">Exam entries</p>
              <p className="text-lg font-semibold text-slate-900">{preview.entryCount}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <p className="text-slate-500">Files required</p>
              <p className="text-lg font-semibold text-slate-900">{preview.fileCount}</p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left">Candidate</th>
                  <th className="px-4 py-3 text-left">UCI</th>
                  <th className="px-4 py-3 text-left">Cand No</th>
                  <th className="px-4 py-3 text-left">Entries</th>
                  <th className="px-4 py-3 text-left">Files</th>
                  <th className="px-4 py-3 text-left">Issues</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {preview.rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                      No locked registrations found for this window.
                    </td>
                  </tr>
                ) : (
                  preview.rows.map((row) => (
                    <tr key={row.candidateId}>
                      <td className="px-4 py-3 font-medium text-slate-900">{row.displayName}</td>
                      <td className="px-4 py-3">{row.uciNumber ?? "—"}</td>
                      <td className="px-4 py-3">{row.candidateNumber ?? "—"}</td>
                      <td className="px-4 py-3">{row.entries.length}</td>
                      <td className="px-4 py-3">
                        {row.filePartCount > 1 ? `${row.filePartCount} files` : "1 file"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {row.issues.length > 0 ? row.issues.join(", ") : "Ready"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </Card>
  );
}
