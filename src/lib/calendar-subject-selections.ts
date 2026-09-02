import { prisma } from "@/lib/prisma";

export interface ExamBoardCalendarFilter {
  enabled: boolean;
  paperIds: Set<string>;
  /** Legacy subject-level selections until re-saved in admin UI. */
  subjectIds: Set<string>;
  /** Subjects that have at least one selected paper. */
  subjectsWithSelectedPapers: Set<string>;
}

export type CalendarSubjectFilterState = Map<string, ExamBoardCalendarFilter>;

export async function getCalendarSubjectFilterState(): Promise<CalendarSubjectFilterState> {
  const [examBoards, paperRows, subjectRows, papers] = await Promise.all([
    prisma.examBoard.findMany({
      select: { id: true, calendarSubjectFilterEnabled: true },
    }),
    prisma.calendarPaperSelection.findMany({
      select: { examBoardId: true, paperId: true },
    }),
    prisma.calendarSubjectSelection.findMany({
      select: { examBoardId: true, subjectId: true },
    }),
    prisma.paper.findMany({
      select: { id: true, subjectId: true },
    }),
  ]);

  const subjectByPaperId = new Map(papers.map((paper) => [paper.id, paper.subjectId]));

  const paperIdsByBoard = new Map<string, Set<string>>();
  for (const row of paperRows) {
    const existing = paperIdsByBoard.get(row.examBoardId);
    if (existing) {
      existing.add(row.paperId);
    } else {
      paperIdsByBoard.set(row.examBoardId, new Set([row.paperId]));
    }
  }

  const subjectIdsByBoard = new Map<string, Set<string>>();
  for (const row of subjectRows) {
    const existing = subjectIdsByBoard.get(row.examBoardId);
    if (existing) {
      existing.add(row.subjectId);
    } else {
      subjectIdsByBoard.set(row.examBoardId, new Set([row.subjectId]));
    }
  }

  return new Map(
    examBoards.map((board) => {
      const paperIds = paperIdsByBoard.get(board.id) ?? new Set<string>();
      const subjectsWithSelectedPapers = new Set<string>();
      for (const paperId of paperIds) {
        const subjectId = subjectByPaperId.get(paperId);
        if (subjectId) subjectsWithSelectedPapers.add(subjectId);
      }

      return [
        board.id,
        {
          enabled: board.calendarSubjectFilterEnabled,
          paperIds,
          subjectIds: subjectIdsByBoard.get(board.id) ?? new Set(),
          subjectsWithSelectedPapers,
        },
      ];
    }),
  );
}

export function isSessionVisibleOnCalendar(
  filterState: CalendarSubjectFilterState,
  examBoardId: string,
  subjectId: string | null | undefined,
  paperId: string | null | undefined,
): boolean {
  if (!paperId) return true;

  const filter = filterState.get(examBoardId);
  if (!filter?.enabled) return true;

  if (filter.paperIds.size > 0) {
    return filter.paperIds.has(paperId);
  }

  if (filter.subjectIds.size > 0 && subjectId) {
    return filter.subjectIds.has(subjectId);
  }

  return true;
}

export function isSubjectVisibleOnCalendar(
  filterState: CalendarSubjectFilterState,
  examBoardId: string,
  subjectId: string | null | undefined,
): boolean {
  if (!subjectId) return true;

  const filter = filterState.get(examBoardId);
  if (!filter?.enabled) return true;

  if (filter.paperIds.size > 0) {
    return filter.subjectsWithSelectedPapers.has(subjectId);
  }

  if (filter.subjectIds.size > 0) {
    return filter.subjectIds.has(subjectId);
  }

  return true;
}

export async function getCalendarSubjectsForExamBoard(examBoardId: string) {
  const filterState = await getCalendarSubjectFilterState();
  const filter = filterState.get(examBoardId);

  let subjectIdFilter: { id: { in: string[] } } | undefined;
  if (filter?.enabled) {
    if (filter.paperIds.size > 0) {
      subjectIdFilter = { id: { in: [...filter.subjectsWithSelectedPapers] } };
    } else if (filter.subjectIds.size > 0) {
      subjectIdFilter = { id: { in: [...filter.subjectIds] } };
    }
  }

  return prisma.subject.findMany({
    where: {
      qualification: { examBoardId },
      ...subjectIdFilter,
    },
    select: {
      id: true,
      name: true,
      code: true,
      qualification: {
        select: { id: true, name: true, level: true },
      },
    },
    orderBy: [{ qualification: { level: "asc" } }, { name: "asc" }],
  });
}
