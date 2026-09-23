import { RegistrationStatus } from "@/generated/prisma/enums";
import { isCieExamBoard } from "@/lib/exam-boards/branch";
import { prisma } from "@/lib/prisma";

export type CieEntriesCandidateRow = {
  candidateId: string;
  englishName: string;
  candidateNumber: string | null;
  centreNumber: string | null;
  entries: Array<{ syllabusCode: string; optionCode: string }>;
  issues: string[];
};

export type CieEntriesPreview = {
  registrationWindowId: string;
  title: string;
  examBoardCode: string;
  centreNumber: string | null;
  candidateCount: number;
  entryCount: number;
  blockingIssueCount: number;
  candidates: CieEntriesCandidateRow[];
  canMarkSubmitted: boolean;
  latestBaselineVersion: number | null;
};

export async function buildCieEntriesPreview(
  registrationWindowId: string,
): Promise<CieEntriesPreview | null> {
  const window = await prisma.registrationWindow.findUnique({
    where: { id: registrationWindowId },
    include: {
      examBoard: {
        select: { id: true, code: true, name: true, centreNumber: true },
      },
    },
  });
  if (!window) return null;
  if (!isCieExamBoard(window.examBoard.code, window.examBoard.name)) {
    return null;
  }

  const assignments = await prisma.cieEntryAssignment.findMany({
    where: {
      registrationWindowId,
      status: { in: [RegistrationStatus.ACTIVE, RegistrationStatus.LOCKED] },
    },
    include: {
      candidate: {
        select: {
          id: true,
          englishName: true,
          examIdentities: {
            where: { examBoardId: window.examBoardId, status: { not: "ARCHIVED" } },
            select: { candidateNumber: true, centreNumber: true },
            take: 1,
          },
        },
      },
    },
    orderBy: [{ syllabusCode: "asc" }, { optionCode: "asc" }],
  });

  const byCandidate = new Map<string, CieEntriesCandidateRow>();

  for (const assignment of assignments) {
    const identity = assignment.candidate.examIdentities[0];
    let row = byCandidate.get(assignment.candidateId);
    if (!row) {
      row = {
        candidateId: assignment.candidateId,
        englishName: assignment.candidate.englishName,
        candidateNumber: identity?.candidateNumber ?? null,
        centreNumber: identity?.centreNumber ?? window.examBoard.centreNumber,
        entries: [],
        issues: [],
      };
      byCandidate.set(assignment.candidateId, row);
    }
    row.entries.push({
      syllabusCode: assignment.syllabusCode,
      optionCode: assignment.optionCode,
    });
  }

  const candidates = [...byCandidate.values()].map((row) => {
    const issues: string[] = [];
    if (!row.candidateNumber?.trim()) issues.push("Missing candidate number");
    if (!row.centreNumber?.trim()) issues.push("Missing centre number");
    if (row.entries.length === 0) issues.push("No CIE entries");
    return { ...row, issues };
  });

  const entryCount = candidates.reduce((sum, row) => sum + row.entries.length, 0);
  const blockingIssueCount = candidates.filter((row) => row.issues.length > 0).length;

  const latest = await prisma.cieBoardSubmissionBaseline.findFirst({
    where: { registrationWindowId },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  return {
    registrationWindowId: window.id,
    title: window.title,
    examBoardCode: window.examBoard.code,
    centreNumber: window.examBoard.centreNumber,
    candidateCount: candidates.length,
    entryCount,
    blockingIssueCount,
    candidates,
    canMarkSubmitted: candidates.length > 0 && blockingIssueCount === 0,
    latestBaselineVersion: latest?.version ?? null,
  };
}

/** Simple Direct-style candidate CSV: Centre, Candidate, Name, Syllabus, Option */
export function buildCieEntriesCsv(preview: CieEntriesPreview): string {
  const lines = ["CentreNumber,CandidateNumber,CandidateName,SyllabusCode,OptionCode"];
  for (const row of preview.candidates) {
    for (const entry of row.entries) {
      lines.push(
        [
          csvEscape(row.centreNumber ?? ""),
          csvEscape(row.candidateNumber ?? ""),
          csvEscape(row.englishName),
          csvEscape(entry.syllabusCode),
          csvEscape(entry.optionCode),
        ].join(","),
      );
    }
  }
  return `${lines.join("\n")}\n`;
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function markCieEntriesSubmitted(params: {
  registrationWindowId: string;
  submittedByUserId: string;
  notes?: string | null;
}) {
  const preview = await buildCieEntriesPreview(params.registrationWindowId);
  if (!preview) {
    throw new Error("CIE window not found");
  }
  if (!preview.canMarkSubmitted) {
    throw new Error("Resolve blocking identity/entry issues before marking submitted");
  }

  const latest = await prisma.cieBoardSubmissionBaseline.findFirst({
    where: { registrationWindowId: params.registrationWindowId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const version = (latest?.version ?? 0) + 1;

  return prisma.cieBoardSubmissionBaseline.create({
    data: {
      registrationWindowId: params.registrationWindowId,
      version,
      submittedByUserId: params.submittedByUserId,
      candidateCount: preview.candidateCount,
      entryCount: preview.entryCount,
      fileCount: 1,
      notes: params.notes ?? null,
      entrySnapshot: preview.candidates,
    },
  });
}
