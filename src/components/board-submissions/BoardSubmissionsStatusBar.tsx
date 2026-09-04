"use client";

import type { BoardSubmissionWindowSummary, TimelineSegment } from "@/lib/board-submissions/types";
import { splitTimelineTracks } from "@/lib/board-submissions/timeline";
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

function formatLegendRange(startAt: string, endAt: string): string {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const sameYear = start.getFullYear() === end.getFullYear();
  const dateFmt = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  const timeFmt = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const startDate = dateFmt.format(start);
  const endDate = dateFmt.format(end);
  const startTime = timeFmt.format(start);
  const endTime = timeFmt.format(end);

  if (startDate === endDate) {
    return `${startDate} ${startTime}–${endTime}`;
  }
  return `${startDate} ${startTime} – ${endDate} ${endTime}`;
}

function timelineRange(summary: BoardSubmissionWindowSummary): { startMs: number; endMs: number } {
  const openMs = new Date(summary.window.studentRegistrationOpenAt).getTime();
  const closeMs =
    new Date(summary.window.registrationCloseAt).getTime() + 24 * 60 * 60 * 1000;
  let startMs = openMs;
  let endMs = closeMs;
  for (const segment of summary.timeline) {
    startMs = Math.min(startMs, new Date(segment.startAt).getTime());
    endMs = Math.max(endMs, new Date(segment.endAt).getTime());
  }
  if (endMs <= startMs) endMs = startMs + 1;
  return { startMs, endMs };
}

function segmentLayout(
  segment: TimelineSegment,
  rangeStartMs: number,
  rangeEndMs: number,
): { left: number; width: number } | null {
  const start = Math.max(new Date(segment.startAt).getTime(), rangeStartMs);
  const end = Math.min(new Date(segment.endAt).getTime(), rangeEndMs);
  if (end <= start) return null;
  const total = rangeEndMs - rangeStartMs;
  const left = ((start - rangeStartMs) / total) * 100;
  const width = ((end - start) / total) * 100;
  return { left, width: Math.max(width, 0.8) };
}

function TrackBar({
  segments,
  rangeStartMs,
  rangeEndMs,
}: {
  segments: TimelineSegment[];
  rangeStartMs: number;
  rangeEndMs: number;
}) {
  return (
    <div className="relative h-3 overflow-hidden rounded-full bg-slate-100">
      {segments.map((segment) => {
        const layout = segmentLayout(segment, rangeStartMs, rangeEndMs);
        if (!layout) return null;
        return (
          <div
            key={`${segment.kind}-${segment.startAt}`}
            className={`absolute top-0 h-full rounded-sm ${segment.colorClass} ${
              segment.isActive ? "ring-2 ring-indigo-600 ring-offset-1" : ""
            } ${segment.isPast ? "opacity-70" : ""}`}
            style={{ left: `${layout.left}%`, width: `${layout.width}%` }}
            title={`${segment.label}: ${formatDateTime(segment.startAt)} – ${formatDateTime(segment.endAt)}`}
          />
        );
      })}
    </div>
  );
}

function LegendColumn({
  title,
  segments,
  emptyMessage,
}: {
  title: string;
  segments: TimelineSegment[];
  emptyMessage?: string;
}) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </p>
      <div className="space-y-2">
        {segments.length === 0 ? (
          <p className="text-xs text-slate-500">{emptyMessage ?? "None"}</p>
        ) : (
          segments.map((segment) => (
            <div
              key={`legend-${segment.kind}-${segment.startAt}`}
              className="flex items-start gap-2 text-xs text-slate-600"
            >
              <span
                className={`mt-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-sm ${segment.colorClass} ${
                  segment.isActive ? "ring-1 ring-indigo-600" : ""
                }`}
              />
              <span>
                <span className="font-medium text-slate-800">{segment.label}</span>
                <span className="mt-0.5 block text-slate-500">
                  {formatLegendRange(segment.startAt, segment.endAt)}
                </span>
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

interface BoardSubmissionsStatusBarProps {
  summary: BoardSubmissionWindowSummary;
  /** Board Submissions shows baseline; Overview omits it. */
  showBaseline?: boolean;
  /** Use plain layout when nested inside another card. */
  variant?: "card" | "plain";
}

export function BoardSubmissionsStatusBar({
  summary,
  showBaseline = true,
  variant = "card",
}: BoardSubmissionsStatusBarProps) {
  const { startMs, endMs } = timelineRange(summary);
  const { permission, fee } = splitTimelineTracks(summary.timeline);
  const nowPercent = (() => {
    const now = new Date(summary.nowAt).getTime();
    if (now <= startMs) return 0;
    if (now >= endMs) return 100;
    return ((now - startMs) / (endMs - startMs)) * 100;
  })();

  const baselineLabel =
    summary.baseline.status === "NONE"
      ? "No baseline yet"
      : `Baseline v${summary.baseline.latest?.version ?? summary.baseline.versionCount}`;

  const body = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{summary.currentPhaseLabel}</p>
          <p className="mt-1 text-sm text-slate-600">{summary.currentPhaseDetail}</p>
          <p className="mt-2 text-xs text-slate-500">
            Student state: {summary.studentState}
            {summary.currentFeeStage ? ` · Fee stage: ${summary.currentFeeStage}` : ""}
          </p>
        </div>
        {showBaseline ? (
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
              <p className="mt-1 text-slate-500">
                Mark a Bulk Entries export as submitted to create baseline.
              </p>
            )}
          </div>
        ) : null}
      </div>

      <div className="space-y-3">
        <p className="text-xs text-slate-500">
          Two tracks on the same calendar: registration access and fee stages may overlap.
        </p>
        <div className="flex gap-3">
          <div className="flex w-28 shrink-0 flex-col justify-around gap-2 py-2">
            <p className="text-xs font-medium leading-3 text-slate-600">Who can register</p>
            <p className="text-xs font-medium leading-3 text-slate-600">Fee stage</p>
          </div>
          <div className="relative min-w-0 flex-1 space-y-2 pt-2">
            <div
              className="pointer-events-none absolute bottom-0 top-0 z-10 -translate-x-1/2"
              style={{ left: `${Math.min(Math.max(nowPercent, 0), 100)}%` }}
              aria-hidden
              title={`Now: ${formatDateTime(summary.nowAt)}`}
            >
              <div className="mx-auto h-0 w-0 border-x-[5px] border-t-[7px] border-x-transparent border-t-red-500" />
              <div className="mx-auto h-[calc(100%-7px)] w-px bg-red-400/70" />
            </div>
            <TrackBar segments={permission} rangeStartMs={startMs} rangeEndMs={endMs} />
            <TrackBar segments={fee} rangeStartMs={startMs} rangeEndMs={endMs} />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <LegendColumn title="Who can register" segments={permission} />
          <LegendColumn
            title="Fee stage"
            segments={fee}
            emptyMessage="No fee stages configured."
          />
        </div>
      </div>
    </div>
  );

  if (variant === "plain") {
    return body;
  }

  return <Card className="space-y-4">{body}</Card>;
}
