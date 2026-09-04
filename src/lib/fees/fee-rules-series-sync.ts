import { prisma } from "@/lib/prisma";
import { STAGE_CODE_OPTIONS } from "@/lib/registrations/stage-labels";

export type SeriesFeeSubject = {
  id: string;
  code: string;
  name: string;
  qualificationId: string;
  qualification: { id: string; name: string; level: string };
};

/** Subjects that have at least one exam session in this window's series set. */
export async function getSubjectsForRegistrationWindowSeries(
  registrationWindowId: string,
): Promise<{
  window: { id: string; examBoardId: string; examSeriesId: string };
  seriesIds: string[];
  subjects: SeriesFeeSubject[];
}> {
  const window = await prisma.registrationWindow.findUnique({
    where: { id: registrationWindowId },
    select: {
      id: true,
      examBoardId: true,
      examSeriesId: true,
      includedSeries: { select: { examSeriesId: true } },
    },
  });

  if (!window) {
    throw new Error("Registration window not found");
  }

  const seriesIds = [
    window.examSeriesId,
    ...window.includedSeries.map((row) => row.examSeriesId),
  ];
  const uniqueSeriesIds = [...new Set(seriesIds)];

  const sessions = await prisma.examSession.findMany({
    where: { examSeriesId: { in: uniqueSeriesIds } },
    select: {
      paper: {
        select: {
          subject: {
            select: {
              id: true,
              code: true,
              name: true,
              qualificationId: true,
              qualification: { select: { id: true, name: true, level: true } },
            },
          },
        },
      },
    },
  });

  const byId = new Map<string, SeriesFeeSubject>();
  for (const session of sessions) {
    const subject = session.paper.subject;
    if (subject.qualificationId && !byId.has(subject.id)) {
      byId.set(subject.id, {
        id: subject.id,
        code: subject.code,
        name: subject.name,
        qualificationId: subject.qualificationId,
        qualification: subject.qualification,
      });
    }
  }

  const subjects = [...byId.values()].sort((a, b) => a.code.localeCompare(b.code));

  return {
    window: {
      id: window.id,
      examBoardId: window.examBoardId,
      examSeriesId: window.examSeriesId,
    },
    seriesIds: uniqueSeriesIds,
    subjects,
  };
}

/**
 * Ensure every series subject has NORMAL / LATE / HIGH_LATE subject-level fee rules.
 * Defaults: cost 0, sales 0 (manual), active.
 */
export async function syncSeriesSubjectFeeRules(
  registrationWindowId: string,
  createdByUserId: string,
): Promise<{ created: number; subjects: number; alreadyPresent: number }> {
  const { window, subjects } = await getSubjectsForRegistrationWindowSeries(
    registrationWindowId,
  );

  if (subjects.length === 0) {
    return { created: 0, subjects: 0, alreadyPresent: 0 };
  }

  const existing = await prisma.feeRule.findMany({
    where: {
      registrationWindowId,
      paperId: null,
      examSessionId: null,
      subjectId: { in: subjects.map((subject) => subject.id) },
    },
    select: { subjectId: true, entryType: true },
  });

  const existingKeys = new Set(
    existing
      .filter((row) => row.subjectId)
      .map((row) => `${row.subjectId}:${row.entryType}`),
  );

  const toCreate: Array<{
    registrationWindowId: string;
    examBoardId: string;
    examSeriesId: string;
    qualificationId: string;
    subjectId: string;
    paperId: null;
    examSessionId: null;
    entryType: "NORMAL" | "LATE" | "HIGH_LATE";
    costCurrency: "GBP";
    costAmount: number;
    exchangeRateToCny: null;
    markupType: "MANUAL";
    markupValue: null;
    salesCurrency: "GBP";
    salesAmount: number;
    isActive: boolean;
    createdByUserId: string;
  }> = [];

  for (const subject of subjects) {
    for (const stage of STAGE_CODE_OPTIONS) {
      const key = `${subject.id}:${stage.value}`;
      if (existingKeys.has(key)) continue;
      toCreate.push({
        registrationWindowId: window.id,
        examBoardId: window.examBoardId,
        examSeriesId: window.examSeriesId,
        qualificationId: subject.qualificationId,
        subjectId: subject.id,
        paperId: null,
        examSessionId: null,
        entryType: stage.value,
        costCurrency: "GBP",
        costAmount: 0,
        exchangeRateToCny: null,
        markupType: "MANUAL",
        markupValue: null,
        salesCurrency: "GBP",
        salesAmount: 0,
        isActive: true,
        createdByUserId,
      });
    }
  }

  if (toCreate.length > 0) {
    await prisma.feeRule.createMany({ data: toCreate });
  }

  const expected = subjects.length * STAGE_CODE_OPTIONS.length;
  return {
    created: toCreate.length,
    subjects: subjects.length,
    alreadyPresent: expected - toCreate.length,
  };
}
