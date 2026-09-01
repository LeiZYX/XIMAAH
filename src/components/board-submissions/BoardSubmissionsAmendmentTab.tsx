"use client";

import type { BoardSubmissionWindowSummary } from "@/lib/board-submissions/types";
import { Card } from "@/components/ui/Card";

export function BoardSubmissionsAmendmentTab({
  summary,
}: {
  summary: BoardSubmissionWindowSummary;
}) {
  const hasBaseline = summary.baseline.status === "ESTABLISHED";

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Amendment</h2>
        <p className="mt-1 text-sm text-slate-600">
          After the Normal entry deadline, export Add and Remove sheets relative to the latest submitted
          baseline.
        </p>
      </div>

      {!hasBaseline ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          No baseline exists yet. Submit Bulk Entries first before generating amendments.
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
          Current baseline: v{summary.baseline.latest?.version} (
          {summary.baseline.latest?.kind === "BULK_ENTRIES" ? "Bulk Entries" : "Amendment"})
          {summary.baseline.latest?.submittedAt
            ? ` · submitted ${new Date(summary.baseline.latest.submittedAt).toLocaleString()}`
            : ""}
        </div>
      )}

      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
        <p className="font-medium text-slate-800">Phase 5 amendment export coming next</p>
        <p className="mt-2">
          Add sheet (max 2 units per row) and Remove sheet (max 5 units per row) will be generated from
          changes since baseline v{summary.baseline.latest?.version ?? "—"}.
        </p>
      </div>
    </Card>
  );
}
