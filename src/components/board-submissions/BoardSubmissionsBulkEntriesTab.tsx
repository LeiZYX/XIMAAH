"use client";

import Link from "next/link";
import type { BoardSubmissionWindowSummary } from "@/lib/board-submissions/types";
import { Card } from "@/components/ui/Card";

export function BoardSubmissionsBulkEntriesTab({
  summary,
  basePath,
}: {
  summary: BoardSubmissionWindowSummary;
  basePath: "/admin" | "/exam-office";
}) {
  const hasBaseline = summary.baseline.status === "ESTABLISHED";

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Bulk Entries</h2>
        <p className="mt-1 text-sm text-slate-600">
          Export the official IAL Bulk Entries template for the first submission to the exam board.
          Candidates with more than 32 specifications will be split across multiple files.
        </p>
      </div>

      {summary.registration.missingIdentityCount > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {summary.registration.missingIdentityCount} locked candidate
          {summary.registration.missingIdentityCount === 1 ? "" : "s"} still missing UCI or candidate number.{" "}
          <Link href={`${basePath}/candidates/board-registration`} className="font-medium underline">
            Fix in Board Registration
          </Link>
        </div>
      ) : null}

      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
        <p className="font-medium text-slate-800">Phase 4 export coming next</p>
        <p className="mt-2">
          Preview, download, and &quot;Mark as submitted&quot; will create baseline v
          {(summary.baseline.latest?.version ?? 0) + 1}
          {hasBaseline ? " (replacing the current baseline chain for amendments)" : ""}.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Locked candidates: {summary.registration.candidateCount} · Exam entries:{" "}
          {summary.registration.examEntryCount}
        </p>
      </div>
    </Card>
  );
}
