"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";

type CiePreview = {
  title: string;
  candidateCount: number;
  entryCount: number;
  blockingIssueCount: number;
  canMarkSubmitted: boolean;
  latestBaselineVersion: number | null;
  candidates: Array<{
    candidateId: string;
    englishName: string;
    candidateNumber: string | null;
    centreNumber: string | null;
    entries: Array<{ syllabusCode: string; optionCode: string }>;
    issues: string[];
  }>;
};

interface BoardSubmissionsCieEntriesTabProps {
  registrationWindowId: string;
  onSubmitted?: () => void;
}

export function BoardSubmissionsCieEntriesTab({
  registrationWindowId,
  onSubmitted,
}: BoardSubmissionsCieEntriesTabProps) {
  const [preview, setPreview] = useState<CiePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/board-submissions/cie-entries/preview?registrationWindowId=${encodeURIComponent(registrationWindowId)}`,
      );
      const data = (await response.json()) as CiePreview & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Failed to load CIE entries preview");
      setPreview(data);
    } catch (err) {
      setPreview(null);
      setError(err instanceof Error ? err.message : "Failed to load preview");
    } finally {
      setLoading(false);
    }
  }, [registrationWindowId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function markSubmitted() {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/board-submissions/cie-entries/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationWindowId }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Failed to mark submitted");
      await load();
      onSubmitted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark submitted");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && !preview) {
    return <Card className="text-sm text-slate-600">Loading CIE entries…</Card>;
  }

  if (error && !preview) {
    return <Card className="text-sm text-rose-700">{error}</Card>;
  }

  if (!preview) return null;

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">CIE Entries (Direct)</h3>
            <p className="text-sm text-slate-600">
              {preview.candidateCount} candidates · {preview.entryCount} syllabus options
              {preview.latestBaselineVersion != null
                ? ` · last submitted v${preview.latestBaselineVersion}`
                : " · not yet marked submitted"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              href={`/api/board-submissions/cie-entries/export?registrationWindowId=${encodeURIComponent(registrationWindowId)}`}
            >
              Export CSV
            </a>
            <button
              type="button"
              disabled={!preview.canMarkSubmitted || submitting}
              onClick={() => void markSubmitted()}
              className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Saving…" : "Mark submitted"}
            </button>
          </div>
        </div>
        {preview.blockingIssueCount > 0 ? (
          <p className="text-sm text-amber-800">
            {preview.blockingIssueCount} candidate(s) have blocking issues (usually missing candidate
            number). Fix identities before marking submitted.
          </p>
        ) : null}
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      </Card>

      <Card className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Candidate</th>
              <th className="px-3 py-2 font-medium">Centre</th>
              <th className="px-3 py-2 font-medium">Cand. no.</th>
              <th className="px-3 py-2 font-medium">Entries</th>
              <th className="px-3 py-2 font-medium">Issues</th>
            </tr>
          </thead>
          <tbody>
            {preview.candidates.map((row) => (
              <tr key={row.candidateId} className="border-b border-slate-100">
                <td className="px-3 py-2">{row.englishName}</td>
                <td className="px-3 py-2">{row.centreNumber ?? "—"}</td>
                <td className="px-3 py-2">{row.candidateNumber ?? "—"}</td>
                <td className="px-3 py-2">
                  {row.entries.map((e) => `${e.syllabusCode}/${e.optionCode}`).join(", ")}
                </td>
                <td className="px-3 py-2 text-amber-800">
                  {row.issues.length ? row.issues.join("; ") : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
