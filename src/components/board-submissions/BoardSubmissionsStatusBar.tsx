"use client";

import type { BoardSubmissionWindowSummary } from "@/lib/board-submissions/types";
import { Card } from "@/components/ui/Card";

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function segmentWidth(startAt: string, endAt: string, windowStart: string, windowEnd: string): number {
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  const totalStart = new Date(windowStart).getTime();
  const totalEnd = new Date(windowEnd).getTime();
  const total = Math.max(totalEnd - totalStart, 1);
  const width = ((end - start) / total) * 100;
  return Math.max(width, 4);
}

export function BoardSubmissionsStatusBar({ summary }: { summary: BoardSubmissionWindowSummary }) {
  const windowStart = summary.window.studentRegistrationOpenAt;
  const windowEnd = summary.window.registrationCloseAt;
  const nowPercent = (() => {
    const now = new Date(summary.nowAt).getTime();
    const start = new Date(windowStart).getTime();
    const end = new Date(windowEnd).getTime();
    if (now <= start) return 0;
    if (now >= end) return 100;
    return ((now - start) / Math.max(end - start, 1)) * 100;
  })();

  const baselineLabel =
    summary.baseline.status === "NONE"
      ? "No baseline yet"
      : `Baseline v${summary.baseline.latest?.version ?? summary.baseline.versionCount}`;

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{summary.currentPhaseLabel}</p>
          <p className="mt-1 text-sm text-slate-600">{summary.currentPhaseDetail}</p>
          <p className="mt-2 text-xs text-slate-500">
            Student state: {summary.studentState}
            {summary.currentFeeStage ? ` · Fee stage: ${summary.currentFeeStage}` : ""}
          </p>
        </div>
        <div className="text-right text-sm">
          <p className="font-medium text-slate-900">{baselineLabel}</p>
          {summary.baseline.latest ? (
            <p className="mt-1 text-slate-600">
              Last submitted {formatDateTime(summary.baseline.latest.submittedAt)}
              {summary.baseline.latest.submittedByName
                ? ` · ${summary.baseline.latest.submittedByName}`
                : ""}
            </p>
          ) : (
            <p className="mt-1 text-slate-500">Mark a Bulk Entries export as submitted to create baseline.</p>
          )}
        </div>
      </div>

      <div>
        <div className="relative h-3 overflow-hidden rounded-full bg-slate-100">
          <div className="flex h-full w-full">
            {summary.timeline.map((segment) => (
              <div
                key={`${segment.kind}-${segment.startAt}`}
                className={`h-full ${segment.colorClass} ${segment.isActive ? "ring-2 ring-indigo-600 ring-offset-1" : ""} ${segment.isPast ? "opacity-70" : ""}`}
                style={{
                  width: `${segmentWidth(segment.startAt, segment.endAt, windowStart, windowEnd)}%`,
                }}
                title={`${segment.label}: ${formatDateTime(segment.startAt)} – ${formatDateTime(segment.endAt)}`}
              />
            ))}
          </div>
          <div
            className="pointer-events-none absolute top-0 h-full w-0.5 bg-slate-900"
            style={{ left: `${Math.min(Math.max(nowPercent, 0), 100)}%` }}
            aria-hidden
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
          {summary.timeline.map((segment) => (
            <span key={`legend-${segment.kind}-${segment.startAt}`} className="inline-flex items-center gap-1.5">
              <span className={`inline-block h-2.5 w-2.5 rounded-sm ${segment.colorClass}`} />
              {segment.label}
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
}
