import type { Prisma } from "@/generated/prisma/client";
import { equalsFilter } from "@/lib/db/string-filters";
import { prisma } from "@/lib/prisma";
import {
  createExternalCandidate,
  generateAssessmentHubCandidateNumber,
  syncCandidateFromStudentUser,
} from "@/lib/candidates/service";

export interface CandidateImportRow {
  studentNumber?: string;
  englishName?: string;
  chineseName?: string;
  email?: string;
  phone?: string;
  grade?: string;
  className?: string;
  externalId?: string;
  assessmentHubCandidateNumber?: string;
}

export async function importInternalCandidates(
  rows: CandidateImportRow[],
  options?: { markMissingInactive?: boolean },
) {
  const results = { created: 0, updated: 0, skipped: 0, errors: [] as string[] };
  const seenStudentNumbers = new Set<string>();

  for (const [index, row] of rows.entries()) {
    const studentNumber = row.studentNumber?.trim();
    const englishName = row.englishName?.trim();
    if (!studentNumber || !englishName) {
      results.skipped += 1;
      continue;
    }

    seenStudentNumbers.add(studentNumber.toLowerCase());

    try {
      const user = await prisma.user.findFirst({
        where: { studentNo: equalsFilter(studentNumber) },
        include: { studentProfile: true, candidate: true },
      });

      if (user?.studentProfile) {
        await syncCandidateFromStudentUser(user.id);
        await prisma.candidate.updateMany({
          where: { userId: user.id },
          data: {
            englishName,
            chineseName: row.chineseName?.trim() || undefined,
            email: row.email?.trim() || undefined,
            phone: row.phone?.trim() || undefined,
            grade: row.grade?.trim() || user.studentProfile.currentGrade,
            className: row.className?.trim() || user.studentProfile.currentClassName,
            externalId: row.externalId?.trim() || undefined,
          },
        });
        results.updated += 1;
        continue;
      }

      await prisma.candidate.create({
        data: {
          candidateType: "INTERNAL",
          assessmentHubCandidateNumber:
            row.assessmentHubCandidateNumber?.trim() || generateAssessmentHubCandidateNumber(),
          studentNumber,
          englishName,
          chineseName: row.chineseName?.trim() || null,
          email: row.email?.trim() || null,
          phone: row.phone?.trim() || null,
          grade: row.grade?.trim() || null,
          className: row.className?.trim() || null,
          externalId: row.externalId?.trim() || null,
          loginEnabled: false,
          status: "ACTIVE",
          sourceSystem: "IMPORT",
        },
      });
      results.created += 1;
    } catch (error) {
      results.errors.push(
        `Row ${index + 1}: ${error instanceof Error ? error.message : "Import failed"}`,
      );
    }
  }

  if (options?.markMissingInactive) {
    await prisma.candidate.updateMany({
      where: {
        candidateType: "INTERNAL",
        studentNumber: { not: null },
        NOT: {
          studentNumber: {
            in: [...seenStudentNumbers].map((value) => value),
          },
        },
      },
      data: { status: "INACTIVE" },
    });
  }

  return results;
}

export async function upsertCandidateExamIdentity(
  candidateId: string,
  examBoardId: string,
  data: {
    centreNumber?: string | null;
    boardCandidateNumber?: string | null;
    uci?: string | null;
    notes?: string | null;
  },
) {
  return prisma.candidateExamIdentity.upsert({
    where: { candidateId_examBoardId: { candidateId, examBoardId } },
    create: {
      candidateId,
      examBoardId,
      centreNumber: data.centreNumber ?? null,
      boardCandidateNumber: data.boardCandidateNumber ?? null,
      uci: data.uci ?? null,
      notes: data.notes ?? null,
    },
    update: {
      centreNumber: data.centreNumber ?? null,
      boardCandidateNumber: data.boardCandidateNumber ?? null,
      uci: data.uci ?? null,
      notes: data.notes ?? null,
    },
    include: { examBoard: { select: { id: true, name: true, code: true } } },
  });
}

export async function updateCandidate(
  id: string,
  data: Prisma.CandidateUpdateInput,
) {
  return prisma.candidate.update({ where: { id }, data });
}
