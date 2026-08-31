import { prisma } from "@/lib/prisma";

export async function validateExamSessionReferences(params: {
  examBoardId: string;
  paperId: string;
  examSeriesId: string;
}): Promise<string | null> {
  const [paper, examSeries] = await Promise.all([
    prisma.paper.findUnique({
      where: { id: params.paperId },
      select: {
        subject: {
          select: {
            qualification: { select: { examBoardId: true } },
          },
        },
      },
    }),
    prisma.examSeries.findUnique({
      where: { id: params.examSeriesId },
      select: { examBoardId: true },
    }),
  ]);

  if (!paper) return "Paper not found";
  if (!examSeries) return "Exam series not found";

  const paperExamBoardId = paper.subject.qualification.examBoardId;
  if (
    paperExamBoardId !== params.examBoardId ||
    examSeries.examBoardId !== params.examBoardId
  ) {
    return "Paper, exam series, and exam board must belong to the same exam board";
  }

  return null;
}
