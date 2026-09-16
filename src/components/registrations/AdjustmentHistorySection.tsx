"use client";

import { formatAdjusterLabel } from "@/lib/registrations/workspace-display";
import {
  formatAdjustmentAttribution,
  formatAdjustmentHeading,
  resolvePostLockAdjustmentHistory,
  type AdjustmentApprovalSnapshot,
  type AdjustmentHistoryBatch,
} from "@/lib/registrations/adjustment-history";

function ExamLineText(item: { subject: string; paperCode: string; paperTitle: string }) {
  return `${item.subject} — ${item.paperCode}${item.paperTitle ? ` ${item.paperTitle}` : ""}`;
}

function ApprovalBlock({
  title,
  approval,
}: {
  title: string;
  approval: AdjustmentApprovalSnapshot;
}) {
  const by = formatAdjusterLabel(approval.byName, approval.byRole);
  const when = approval.at ? new Date(approval.at).toLocaleString() : "—";
  return (
    <div className="mt-2">
      <p className="font-medium text-slate-800">
        {title}: {approval.decision}
      </p>
      <p className="mt-0.5 text-slate-600">
        By: {by || "—"}
        {approval.at ? ` · On: ${when}` : null}
      </p>
      <p className="mt-0.5 whitespace-pre-wrap text-slate-700">
        <span className="font-medium">Note:</span> {approval.reason?.trim() || "—"}
      </p>
    </div>
  );
}

export function AdjustmentBatchBody({ batch }: { batch: AdjustmentHistoryBatch }) {
  const hasStructuredApprovals =
    Boolean(batch.studentReasons && batch.studentReasons.length > 0) ||
    Boolean(batch.teacherApproval) ||
    Boolean(batch.eoApproval);

  return (
    <div className="mt-2 space-y-2 text-sm text-slate-800">
      {batch.added.length > 0 ? (
        <div>
          <p className="font-medium text-emerald-800">Added</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {batch.added.map((item, i) => (
              <li key={`a-${i}`}>{ExamLineText(item)}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {batch.removed.length > 0 ? (
        <div>
          <p className="font-medium text-rose-800">Removed</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {batch.removed.map((item, i) => (
              <li key={`r-${i}`}>{ExamLineText(item)}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {batch.replaced.length > 0 ? (
        <div>
          <p className="font-medium text-slate-800">Replaced</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {batch.replaced.map((item, i) => (
              <li key={`p-${i}`}>
                {ExamLineText(item.from)} → {ExamLineText(item.to)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {batch.studentReasons && batch.studentReasons.length > 0 ? (
        <div>
          <p className="font-medium text-slate-800">Student reason</p>
          <ul className="mt-1 space-y-1">
            {batch.studentReasons.map((line, i) => (
              <li key={`sr-${i}`} className="whitespace-pre-wrap">
                <span className="font-medium text-slate-700">
                  {line.itemType === "ADD" ? "Add" : "Remove"} — {line.label}:
                </span>{" "}
                {line.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {batch.teacherApproval ? (
        <ApprovalBlock title="Teacher approval" approval={batch.teacherApproval} />
      ) : null}
      {batch.eoApproval ? (
        <ApprovalBlock title="Exams Office approval" approval={batch.eoApproval} />
      ) : null}

      {!hasStructuredApprovals && batch.reason ? (
        <div>
          <p className="font-medium text-slate-800">Reason</p>
          <p className="mt-1 whitespace-pre-wrap text-slate-700">{batch.reason}</p>
        </div>
      ) : null}

      <p className="text-slate-600">
        <span className="font-medium text-slate-800">Adjusted by:</span>{" "}
        {formatAdjustmentAttribution(batch)}
      </p>
      <p className="text-slate-600">
        <span className="font-medium text-slate-800">Adjusted on:</span>{" "}
        {new Date(batch.adjustedAt).toLocaleString()}
      </p>
    </div>
  );
}

export function AdjustmentHistorySection({
  batches: batchesProp,
  lastAdjustmentSummary,
  hasPostLockAdjustment,
  title = "Adjustment history",
  className,
}: {
  batches?: AdjustmentHistoryBatch[] | null;
  lastAdjustmentSummary?: string | null;
  hasPostLockAdjustment?: boolean;
  title?: string;
  className?: string;
}) {
  const batches =
    batchesProp && batchesProp.length > 0
      ? batchesProp
      : resolvePostLockAdjustmentHistory({
          lastAdjustmentSummary,
        });

  if (batches.length === 0) {
    if (!hasPostLockAdjustment) return null;
    return null;
  }

  return (
    <section className={className ?? "border-t border-slate-200 pt-4"}>
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      <div className="mt-3 space-y-3">
        {batches.map((batch, index) => (
          <div
            key={`${batch.adjustedAt}-${index}`}
            className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-3"
          >
            <p className="text-sm font-medium text-amber-950">
              {formatAdjustmentHeading(batch, index, batches.length)}
            </p>
            <AdjustmentBatchBody batch={batch} />
          </div>
        ))}
      </div>
    </section>
  );
}
