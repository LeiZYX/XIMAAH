"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { BoardSubmissionWindowSummary } from "@/lib/board-submissions/types";
import type { AmendmentPreview } from "@/lib/board-submissions/amendment/types";
import { amendmentUnitCode } from "@/lib/board-submissions/entry-utils";
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

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Amendment</h2>
          <p className="mt-1 text-sm text-slate-600">
            After the Normal entry deadline, export Add and Remove sheets relative to the latest
            submitted baseline. Add rows support up to 2 units each; Remove rows support up to 5
            units each.
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
            Download
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
          No changes since baseline v{preview.baselineVersion}.
        </div>
      ) : null}

      {preview && preview.hasChanges ? (
        <>
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

          {preview.addRows.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-900">Add sheet</h3>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left">Candidate</th>
                      <th className="px-4 py-3 text-left">Centre</th>
                      <th className="px-4 py-3 text-left">Cand No</th>
                      <th className="px-4 py-3 text-left">Units</th>
                      <th className="px-4 py-3 text-left">Issues</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {preview.addRows.map((row, index) => (
                      <tr key={`add-${row.candidateId}-${index}`}>
                        <td className="px-4 py-3 font-medium text-slate-900">{row.displayName}</td>
                        <td className="px-4 py-3">{row.centreNumber ?? "—"}</td>
                        <td className="px-4 py-3">{row.candidateNumber ?? "—"}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {row.entries
                            .map((entry) => `${entry.specification}/${entry.specOption}`)
                            .join(", ")}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {row.issues.length > 0 ? row.issues.join(", ") : "Ready"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {preview.removeRows.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-900">Remove sheet</h3>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left">Candidate</th>
                      <th className="px-4 py-3 text-left">Centre</th>
                      <th className="px-4 py-3 text-left">Cand No</th>
                      <th className="px-4 py-3 text-left">Units</th>
                      <th className="px-4 py-3 text-left">Issues</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {preview.removeRows.map((row, index) => (
                      <tr key={`remove-${row.candidateId}-${index}`}>
                        <td className="px-4 py-3 font-medium text-slate-900">{row.displayName}</td>
                        <td className="px-4 py-3">{row.centreNumber ?? "—"}</td>
                        <td className="px-4 py-3">{row.candidateNumber ?? "—"}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {row.entries.map((entry) => amendmentUnitCode(entry)).join(", ")}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {row.issues.length > 0 ? row.issues.join(", ") : "Ready"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}
