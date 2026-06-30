import {
  formatIncludedSessionDateRange,
  formatIncludedSessionShortLabel,
  type IncludedExamSession,
} from "@/lib/registrations/included-series";

export function IncludedExamSessionsList({
  sessions,
  compact = false,
  showBoard = false,
}: {
  sessions: IncludedExamSession[];
  compact?: boolean;
  showBoard?: boolean;
}) {
  if (sessions.length === 0) {
    return <p className="text-sm text-slate-500">No included exam sessions configured.</p>;
  }

  return (
    <ul className={compact ? "list-inside list-disc space-y-0.5 text-sm text-slate-700" : "space-y-2"}>
      {sessions.map((session) => {
        const dateRange = formatIncludedSessionDateRange(session.startDate, session.endDate);
        const label = showBoard
          ? `${session.examBoard.name} · ${formatIncludedSessionShortLabel(session)}`
          : formatIncludedSessionShortLabel(session);
        return (
          <li key={session.id} className={compact ? undefined : "text-sm"}>
            <span className="font-medium text-slate-900">{label}</span>
            {dateRange ? (
              <span className="ml-2 text-xs text-slate-500">{dateRange}</span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
