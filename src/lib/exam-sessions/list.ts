import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const examSessionListInclude = {
  paper: {
    select: {
      id: true,
      code: true,
      title: true,
      subject: {
        select: {
          name: true,
          qualification: {
            select: {
              name: true,
              examBoard: { select: { id: true, name: true, code: true } },
            },
          },
        },
      },
    },
  },
  examSeries: {
    select: {
      id: true,
      name: true,
      year: true,
      examBoard: { select: { id: true, name: true, code: true } },
    },
  },
} satisfies Prisma.ExamSessionInclude;

export type ExamSessionListRow = Prisma.ExamSessionGetPayload<{
  include: typeof examSessionListInclude;
}>;

export function buildExamSessionListWhere(params: {
  examBoardId?: string | null;
  examSeriesId?: string | null;
  paperId?: string | null;
  subjectId?: string | null;
  paperQ?: string | null;
}): Prisma.ExamSessionWhereInput {
  const examBoardId = params.examBoardId?.trim() || undefined;
  const examSeriesId = params.examSeriesId?.trim() || undefined;
  const paperId = params.paperId?.trim() || undefined;
  const subjectId = params.subjectId?.trim() || undefined;
  const paperQ = params.paperQ?.trim() || undefined;

  const paperFilter: Prisma.PaperWhereInput = {
    ...(subjectId ? { subjectId } : {}),
    ...(paperQ
      ? {
          OR: [
            { code: { contains: paperQ } },
            { title: { contains: paperQ } },
            { subject: { name: { contains: paperQ } } },
          ],
        }
      : {}),
  };

  return {
    ...(examSeriesId ? { examSeriesId } : {}),
    ...(paperId ? { paperId } : {}),
    ...(examBoardId ? { examSeries: { examBoardId } } : {}),
    ...(Object.keys(paperFilter).length > 0 ? { paper: paperFilter } : {}),
  };
}

export async function listExamSessions(params: {
  where: Prisma.ExamSessionWhereInput;
  skip?: number;
  take?: number;
}): Promise<ExamSessionListRow[]> {
  return prisma.examSession.findMany({
    where: params.where,
    orderBy: [{ date: "asc" }, { startTime: "asc" }, { paper: { code: "asc" } }],
    skip: params.skip,
    take: params.take,
    include: examSessionListInclude,
  });
}

export function formatExamSessionExportRows(sessions: ExamSessionListRow[]) {
  return sessions.map((session) => ({
    "Exam Board Code": session.examSeries.examBoard.code,
    "Exam Board": session.examSeries.examBoard.name,
    Date: session.date.toISOString().slice(0, 10),
    "Paper Code": session.paper.code,
    "Paper Title": session.paper.title,
    Subject: session.paper.subject.name,
    "Exam Series": session.examSeries.name,
    Year: session.examSeries.year,
    "Start Time": session.startTime ?? "",
    "End Time": session.endTime ?? "",
    Venue: session.venue ?? "",
    Notes: session.notes ?? "",
  }));
}
