"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { BoardSubmissionWindowSummary } from "@/lib/board-submissions/types";
import type { AmendmentPreview } from "@/lib/board-submissions/amendment/types";
import { buildAmendmentSheetPreview } from "@/lib/board-submissions/amendment/export";
import { BoardSubmissionExcelPreviewTable } from "@/components/board-submissions/BoardSubmissionExcelPreviewTable";
import { Card } from "@/components/ui/Card";

export function BoardSubmissionsAmendmentTab({
  summary,
  basePath,
  onSubmitted,
}: {
  summary: BoardSubmissionWindowSummary;
  basePath: "/admin" | "/exam-office";
  onSubmitted?: () => void;
}) {
  const registrationWindowId = summary.window.id;
  const hasBaseline = summary.baseline.status === "ESTABLISHED";
  const [preview, setPreview] = useState<AmendmentPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/board-submissions/amendment/preview?registrationWindowId=${encodeURIComponent(registrationWindowId)}`,
      );
      const data = (await response.json()) as AmendmentPreview & { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load amendment preview");
      }
      setPreview(data);
    } catch (err) {
      setPreview(null);
      setError(err instanceof Error ? err.message : "Failed to load amendment preview");
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
      `Mark Amendment as submitted to the exam board?\n\nThis will create baseline v${(summary.baseline.latest?.version ?? 0) + 1} with ${preview.addEntryCount} add(s) and ${preview.removeEntryCount} remove(s).`,
    );
    if (!confirmed) return;

    setSubmitting(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/board-submissions/amendment/submit", {
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

  const excelPreview =
    preview && preview.hasChanges
      ? buildAmendmentSheetPreview({
          addRows: preview.addRows,
          removeRows: preview.removeRows,
        })
      : null;

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Amendment</h2>
          <p className="mt-1 text-sm text-slate-600">
            Export Add and Remove sheets for changes since the latest submitted baseline. After you
            mark an amendment as submitted, download it from submission history below. New add/remove
            rows appear here once registrations change again.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={
              preview?.canExport
                ? `/api/board-submissions/amendment/export?registrationWindowId=${encodeURIComponent(registrationWindowId)}`
                : undefined
            }
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              preview?.canExport
                ? "bg-white text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-50"
                : "cursor-not-allowed bg-slate-100 text-slate-400"
            }`}
            aria-disabled={!preview?.canExport}
            onClick={(event) => {
              if (!preview?.canExport) event.preventDefault();
            }}
          >
            Download pending
          </a>
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

      {!hasBaseline ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          No baseline exists yet. Submit Bulk Entries first before generating amendments.
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
          Comparing against baseline v{summary.baseline.latest?.version} (
          {summary.baseline.latest?.kind === "BULK_ENTRIES" ? "Bulk Entries" : "Amendment"})
          {summary.baseline.latest?.submittedAt
            ? ` · submitted ${new Date(summary.baseline.latest.submittedAt).toLocaleString()}`
            : ""}
        </div>
      )}

      {loading ? <p className="text-sm text-slate-600">Loading amendment preview…</p> : null}
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

      {preview && !preview.hasChanges && hasBaseline ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <p className="font-medium text-slate-900">No pending amendment</p>
          <p className="mt-1">
            Current registrations match baseline v{preview.baselineVersion}. Adjust registrations to
            generate the next add/remove export, then mark it as submitted here.
          </p>
        </div>
      ) : null}

      {preview && preview.hasChanges ? (
        <>
          <h3 className="text-sm font-semibold text-slate-900">Pending amendment</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <p className="text-slate-500">Candidates changed</p>
              <p className="text-lg font-semibold text-slate-900">{preview.changedCandidateCount}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <p className="text-slate-500">Add entries</p>
              <p className="text-lg font-semibold text-slate-900">{preview.addEntryCount}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <p className="text-slate-500">Remove entries</p>
              <p className="text-lg font-semibold text-slate-900">{preview.removeEntryCount}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <p className="text-slate-500">Add rows</p>
              <p className="text-lg font-semibold text-slate-900">{preview.addRowCount}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <p className="text-slate-500">Remove rows</p>
              <p className="text-lg font-semibold text-slate-900">{preview.removeRowCount}</p>
            </div>
          </div>

          {excelPreview && excelPreview.add.rows.length > 0 ? (
            <BoardSubmissionExcelPreviewTable
              title="Add sheet"
              headers={excelPreview.add.headers}
              rows={excelPreview.add.rows}
            />
          ) : null}

          {excelPreview && excelPreview.remove.rows.length > 0 ? (
            <BoardSubmissionExcelPreviewTable
              title="Remove sheet"
              headers={excelPreview.remove.headers}
              rows={excelPreview.remove.rows}
            />
          ) : null}

          {preview.addRows.some((row) => row.issues.length > 0) ||
          preview.removeRows.some((row) => row.issues.length > 0) ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <p className="font-medium text-slate-900">Row validation</p>
              <ul className="mt-2 space-y-1">
                {[...preview.addRows, ...preview.removeRows]
                  .filter((row) => row.issues.length > 0)
                  .map((row, index) => (
                    <li key={`${row.candidateId}-${index}`}>
                      {row.displayName}: {row.issues.join(", ")}
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}

      {preview && preview.submissionHistory.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Submitted amendments</h3>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left">Baseline</th>
                  <th className="px-4 py-3 text-left">Compared to</th>
                  <th className="px-4 py-3 text-left">Submitted</th>
                  <th className="px-4 py-3 text-left">Adds</th>
                  <th className="px-4 py-3 text-left">Removes</th>
                  <th className="px-4 py-3 text-left">Download</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {preview.submissionHistory.map((record) => (
                  <tr key={record.baselineVersion}>
                    <td className="px-4 py-3 font-medium text-slate-900">v{record.baselineVersion}</td>
                    <td className="px-4 py-3 text-slate-600">v{record.comparedAgainstVersion}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {new Date(record.submittedAt).toLocaleString()}
                      {record.submittedByName ? ` · ${record.submittedByName}` : ""}
                    </td>
                    <td className="px-4 py-3">{record.addEntryCount}</td>
                    <td className="px-4 py-3">{record.removeEntryCount}</td>
                    <td className="px-4 py-3">
                      {record.canDownload ? (
                        <a
                          href={`/api/board-submissions/amendment/export?registrationWindowId=${encodeURIComponent(registrationWindowId)}&baselineVersion=${record.baselineVersion}`}
                          className="font-medium text-indigo-700 hover:text-indigo-900"
                        >
                          Download
                        </a>
                      ) : (
                        <span className="text-slate-400">Unavailable</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
