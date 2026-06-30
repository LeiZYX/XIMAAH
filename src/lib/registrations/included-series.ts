import type { Prisma } from "@/generated/prisma/client";

export const includedSeriesInclude = {
  examSeries: {
    select: {
      id: true,
      name: true,
      year: true,
      startDate: true,
      endDate: true,
      examBoard: { select: { id: true, name: true, code: true } },
    },
  },
} satisfies Prisma.RegistrationWindowIncludedSeriesInclude;

export type IncludedExamSession = {
  id: string;
  examSeriesId: string;
  name: string;
  year: number;
  startDate: string | null;
  endDate: string | null;
  examBoard: { id: string; name: string; code: string };
};

/** Short label for lists when exam board is shown separately, e.g. "Summer 2027". */
export function formatIncludedSessionShortLabel(session: {
  name: string;
  year: number;
}): string {
  return `${session.name} ${session.year}`;
}

export function formatIncludedSessionLabel(session: {
  examBoard: { name: string };
  name: string;
  year: number;
}): string {
  return `${session.examBoard.name} · ${formatIncludedSessionShortLabel(session)}`;
}

export function formatIncludedSessionDateRange(
  startDate: Date | string | null | undefined,
  endDate: Date | string | null | undefined,
): string | null {
  if (!startDate && !endDate) return null;
  const start = startDate ? new Date(startDate).toLocaleDateString() : "—";
  const end = endDate ? new Date(endDate).toLocaleDateString() : "—";
  return `${start} – ${end}`;
}

const compactMonth = new Intl.DateTimeFormat("en-GB", { month: "short" });

export function formatIncludedSessionCompactRange(
  startDate: Date | string | null | undefined,
  endDate: Date | string | null | undefined,
): string | null {
  if (!startDate && !endDate) return null;

  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;
  const anchor = end ?? start;
  if (!anchor || Number.isNaN(anchor.getTime())) return null;

  const year = anchor.getFullYear();
  if (start && end && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
    const startMonth = compactMonth.format(start);
    const endMonth = compactMonth.format(end);
    if (startMonth === endMonth && start.getFullYear() === end.getFullYear()) {
      return `${startMonth} ${year}`;
    }
    return `${startMonth}–${endMonth} ${year}`;
  }

  if (start && !Number.isNaN(start.getTime())) {
    return `${compactMonth.format(start)} ${start.getFullYear()}`;
  }
  if (end && !Number.isNaN(end.getTime())) {
    return `${compactMonth.format(end)} ${end.getFullYear()}`;
  }
  return null;
}

export function mapIncludedSeries(
  rows: Array<{
    examSeriesId: string;
    examSeries: {
      id: string;
      name: string;
      year: number;
      startDate: Date | null;
      endDate: Date | null;
      examBoard: { id: string; name: string; code: string };
    };
  }>,
): IncludedExamSession[] {
  return rows.map((row) => ({
    id: row.examSeriesId,
    examSeriesId: row.examSeriesId,
    name: row.examSeries.name,
    year: row.examSeries.year,
    startDate: row.examSeries.startDate?.toISOString() ?? null,
    endDate: row.examSeries.endDate?.toISOString() ?? null,
    examBoard: row.examSeries.examBoard,
  }));
}

export function getIncludedSeriesIds(
  window: {
    examSeriesId: string;
    includedSeries?: Array<{ examSeriesId: string }>;
  },
): string[] {
  if (window.includedSeries && window.includedSeries.length > 0) {
    return window.includedSeries.map((row) => row.examSeriesId);
  }
  return [window.examSeriesId];
}

export function windowIncludesSeries(
  window: {
    examBoardId: string;
    examSeriesId: string;
    includedSeries?: Array<{ examSeriesId: string; examSeries?: { examBoardId: string } }>;
  },
  examSeriesId: string,
  examBoardId?: string,
): boolean {
  if (window.includedSeries && window.includedSeries.length > 0) {
    return window.includedSeries.some((row) => {
      if (row.examSeriesId !== examSeriesId) return false;
      if (!examBoardId) return true;
      return row.examSeries?.examBoardId === examBoardId;
    });
  }

  if (window.examSeriesId !== examSeriesId) return false;
  if (examBoardId && window.examBoardId !== examBoardId) return false;
  return true;
}

export function indexWindowsByBoardSeries<
  T extends {
    examBoardId: string;
    examSeriesId: string;
    includedSeries?: Array<{
      examSeriesId: string;
      examSeries?: { examBoardId: string };
    }>;
  },
>(windows: T[]): Map<string, T> {
  const map = new Map<string, T>();
  const key = (boardId: string, seriesId: string) => `${boardId}:${seriesId}`;

  for (const window of windows) {
    if (window.includedSeries && window.includedSeries.length > 0) {
      for (const row of window.includedSeries) {
        const boardId = row.examSeries?.examBoardId ?? window.examBoardId;
        map.set(key(boardId, row.examSeriesId), window);
      }
      continue;
    }

    map.set(key(window.examBoardId, window.examSeriesId), window);
  }

  return map;
}

export const registrationWindowSeriesInclude = {
  includedSeries: {
    orderBy: { createdAt: "asc" as const },
    include: includedSeriesInclude,
  },
  examBoard: { select: { id: true, name: true, code: true } },
  examSeries: { select: { id: true, name: true, year: true } },
} satisfies Prisma.RegistrationWindowInclude;

export async function validateIncludedSeriesForBoard(
  examBoardId: string,
  examSeriesIds: string[],
  loadSeries: (ids: string[]) => Promise<
    Array<{ id: string; examBoardId: string; examBoard: { id: string; name: string } }>
  >,
) {
  if (!examBoardId) {
    throw new Error("Exam board is required");
  }
  if (examSeriesIds.length === 0) {
    throw new Error("At least one applicable exam session is required");
  }

  const seriesRows = await loadSeries(examSeriesIds);
  if (seriesRows.length !== examSeriesIds.length) {
    throw new Error("One or more included exam sessions were not found");
  }

  const invalid = seriesRows.find((row) => row.examBoardId !== examBoardId);
  if (invalid) {
    throw new Error("All selected exam sessions must belong to the selected exam board");
  }

  return seriesRows;
}
