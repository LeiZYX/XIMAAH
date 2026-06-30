"use client";

import {
  formatIncludedSessionCompactRange,
  formatIncludedSessionShortLabel,
} from "@/lib/registrations/included-series";

export interface SelectableExamSession {
  id: string;
  name: string;
  year: number;
  startDate: string | null;
  endDate: string | null;
}

export function ApplicableExamSessionsPicker({
  sessions,
  selectedIds,
  onToggle,
  loading = false,
  emptyMessage = "No exam sessions available for this exam board.",
}: {
  sessions: SelectableExamSession[];
  selectedIds: string[];
  onToggle: (sessionId: string, selected: boolean) => void;
  loading?: boolean;
  emptyMessage?: string;
}) {
  if (loading) {
    return <p className="text-sm text-slate-500">Loading sessions…</p>;
  }

  if (sessions.length === 0) {
    return <p className="text-sm text-slate-500">{emptyMessage}</p>;
  }

  return (
    <ul className="space-y-2">
      {sessions.map((session) => {
        const selected = selectedIds.includes(session.id);
        const dateRange = formatIncludedSessionCompactRange(session.startDate, session.endDate);
        const label = formatIncludedSessionShortLabel(session);

        return (
          <li key={session.id}>
            <button
              type="button"
              onClick={() => onToggle(session.id, !selected)}
              className={`w-full border px-3 py-2.5 text-left text-sm transition ${
                selected
                  ? "border-indigo-600 bg-indigo-50"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <div className="flex items-start gap-2">
                <span className="mt-0.5 text-base leading-none text-indigo-700" aria-hidden>
                  {selected ? "☑" : "☐"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-slate-900">{label}</span>
                  {dateRange ? (
                    <span className="mt-0.5 block text-xs text-slate-500">{dateRange}</span>
                  ) : null}
                </span>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
