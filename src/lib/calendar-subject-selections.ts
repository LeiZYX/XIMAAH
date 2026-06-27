import { prisma } from "@/lib/prisma";

export interface ExamBoardSubjectFilter {
  enabled: boolean;
  subjectIds: Set<string>;
}

export type CalendarSubjectFilterState = Map<string, ExamBoardSubjectFilter>;

export async function getCalendarSubjectFilterState(): Promise<CalendarSubjectFilterState> {
  const [examBoards, rows] = await Promise.all([
    prisma.examBoard.findMany({
      select: { id: true, calendarSubjectFilterEnabled: true },
    }),
    prisma.calendarSubjectSelection.findMany({
      select: { examBoardId: true, subjectId: true },
    }),
  ]);

  const subjectIdsByBoard = new Map<string, Set<string>>();
  for (const row of rows) {
    const existing = subjectIdsByBoard.get(row.examBoardId);
    if (existing) {
      existing.add(row.subjectId);
    } else {
      subjectIdsByBoard.set(row.examBoardId, new Set([row.subjectId]));
    }
  }

  return new Map(
    examBoards.map((board) => [
      board.id,
      {
        enabled: board.calendarSubjectFilterEnabled,
        subjectIds: subjectIdsByBoard.get(board.id) ?? new Set(),
      },
    ]),
  );
}

export function isSubjectVisibleOnCalendar(
  filterState: CalendarSubjectFilterState,
  examBoardId: string,
  subjectId: string | null | undefined,
): boolean {
  if (!subjectId) return true;

  const filter = filterState.get(examBoardId);
  if (!filter?.enabled) return true;

  return filter.subjectIds.has(subjectId);
}
