"use client";

import { formatMoney } from "@/lib/fees/money";
import type {
  BoardSubmissionFinancialSummary,
  BoardSubmissionRegistrationSummary,
} from "@/lib/board-submissions/types";
import { Card } from "@/components/ui/Card";

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function BoardSubmissionsSummaryCards({
  registration,
  financial,
}: {
  registration: BoardSubmissionRegistrationSummary;
  financial: BoardSubmissionFinancialSummary;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Registration overview</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Metric label="Candidates" value={String(registration.candidateCount)} />
          <Metric label="Exam entries" value={String(registration.examEntryCount)} />
          <Metric
            label="Internal / External"
            value={`${registration.internalCandidateCount} / ${registration.externalCandidateCount}`}
          />
          <Metric
            label="Missing board identity"
            value={String(registration.missingIdentityCount)}
            hint={
              registration.missingIdentityCount > 0
                ? "UCI or candidate number missing for this exam board"
                : undefined
            }
          />
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Financial overview (GBP)</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Metric
            label="Total receivable"
            value={formatMoney(financial.totalReceivableGbp, "GBP")}
          />
          <Metric label="Amount due" value={formatMoney(financial.amountDueGbp, "GBP")} />
          <Metric label="Paid" value={formatMoney(financial.paidGbp, "GBP")} />
          <Metric
            label="Pending refund"
            value={formatMoney(financial.pendingRefundGbp, "GBP")}
          />
          <Metric
            label="Completed refund"
            value={formatMoney(financial.completedRefundGbp, "GBP")}
          />
          <Metric
            label="Uncertain"
            value={formatMoney(financial.uncertainGbp, "GBP")}
            hint="Draft or needs-regeneration statements"
          />
          <Metric
            label="Platform fee (est.)"
            value={formatMoney(financial.platformFeeGbp, "GBP")}
            hint="Estimated from withdrawal refund policy"
          />
        </div>
      </Card>
    </div>
  );
}
