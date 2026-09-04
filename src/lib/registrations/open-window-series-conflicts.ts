import { formatIncludedSessionShortLabel } from "@/lib/registrations/included-series";

export type OpenWindowSeriesConflictWindow = {
  id: string;
  title: string;
  academicYear: string;
};

export type OpenWindowSeriesConflict = {
  examBoardId: string;
  examBoardCode: string;
  examBoardName: string;
  examSeriesId: string;
  examSeriesLabel: string;
  windows: OpenWindowSeriesConflictWindow[];
};

export type OpenWindowSeriesConflictInput = {
  id: string;
  title: string;
  academicYear: string;
  status: string;
  examBoardId: string;
  examSeriesId: string;
  examBoard?: { id: string; name: string; code: string } | null;
  examSeries?: { id: string; name: string; year: number } | null;
  includedSeries?: Array<{
    examSeriesId: string;
    examSeries?: {
      name: string;
      year: number;
      examBoardId?: string;
      examBoard?: { id: string; name: string; code: string };
    } | null;
  }>;
  includedExamSessions?: Array<{
    examSeriesId: string;
    name: string;
    year: number;
    examBoard: { id: string; name: string; code: string };
  }>;
};

type CoverageMeta = {
  examBoardId: string;
  examBoardCode: string;
  examBoardName: string;
  examSeriesId: string;
  examSeriesLabel: string;
};

function boardSeriesKey(boardId: string, seriesId: string): string {
  return `${boardId}:${seriesId}`;
}

function collectCoverages(window: OpenWindowSeriesConflictInput): CoverageMeta[] {
  if (window.includedExamSessions && window.includedExamSessions.length > 0) {
    return window.includedExamSessions.map((session) => ({
      examBoardId: session.examBoard.id,
      examBoardCode: session.examBoard.code,
      examBoardName: session.examBoard.name,
      examSeriesId: session.examSeriesId,
      examSeriesLabel: formatIncludedSessionShortLabel(session),
    }));
  }

  if (window.includedSeries && window.includedSeries.length > 0) {
    return window.includedSeries.flatMap((row) => {
      const series = row.examSeries;
      if (!series) return [];
      const board = series.examBoard ?? window.examBoard;
      const boardId = series.examBoardId ?? board?.id ?? window.examBoardId;
      if (!board) {
        return [
          {
            examBoardId: boardId,
            examBoardCode: "?",
            examBoardName: "Unknown board",
            examSeriesId: row.examSeriesId,
            examSeriesLabel: formatIncludedSessionShortLabel({
              name: series.name,
              year: series.year,
            }),
          },
        ];
      }
      return [
        {
          examBoardId: boardId,
          examBoardCode: board.code,
          examBoardName: board.name,
          examSeriesId: row.examSeriesId,
          examSeriesLabel: formatIncludedSessionShortLabel({
            name: series.name,
            year: series.year,
          }),
        },
      ];
    });
  }

  const board = window.examBoard;
  const series = window.examSeries;
  return [
    {
      examBoardId: board?.id ?? window.examBoardId,
      examBoardCode: board?.code ?? "?",
      examBoardName: board?.name ?? "Unknown board",
      examSeriesId: series?.id ?? window.examSeriesId,
      examSeriesLabel: series
        ? formatIncludedSessionShortLabel(series)
        : window.examSeriesId,
    },
  ];
}

/**
 * Finds Active (OPEN) registration windows that both cover the same
 * exam board + exam series. Closed/Draft windows that still list the same
 * series do not count — Active series remain available.
 *
 * Calendar/student surfaces keep only one Active window per board:series key,
 * so two Active duplicates hide one of them.
 */
export function findOpenWindowSeriesConflicts(
  windows: OpenWindowSeriesConflictInput[],
): OpenWindowSeriesConflict[] {
  type Bucket = {
    meta: CoverageMeta;
    byId: Map<string, OpenWindowSeriesConflictWindow>;
  };

  const buckets = new Map<string, Bucket>();

  for (const window of windows) {
    if (window.status !== "OPEN") continue;

    const ref: OpenWindowSeriesConflictWindow = {
      id: window.id,
      title: window.title,
      academicYear: window.academicYear,
    };

    for (const coverage of collectCoverages(window)) {
      const key = boardSeriesKey(coverage.examBoardId, coverage.examSeriesId);
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { meta: coverage, byId: new Map() };
        buckets.set(key, bucket);
      }
      bucket.byId.set(ref.id, ref);
    }
  }

  return [...buckets.values()]
    .filter((bucket) => bucket.byId.size > 1)
    .map((bucket) => ({
      examBoardId: bucket.meta.examBoardId,
      examBoardCode: bucket.meta.examBoardCode,
      examBoardName: bucket.meta.examBoardName,
      examSeriesId: bucket.meta.examSeriesId,
      examSeriesLabel: bucket.meta.examSeriesLabel,
      windows: [...bucket.byId.values()].sort((a, b) =>
        a.title.localeCompare(b.title),
      ),
    }))
    .sort((a, b) => {
      const board = a.examBoardCode.localeCompare(b.examBoardCode);
      if (board !== 0) return board;
      return a.examSeriesLabel.localeCompare(b.examSeriesLabel);
    });
}

export function conflictsForWindow(
  conflicts: OpenWindowSeriesConflict[],
  windowId: string,
): OpenWindowSeriesConflict[] {
  return conflicts.filter((conflict) =>
    conflict.windows.some((window) => window.id === windowId),
  );
}
