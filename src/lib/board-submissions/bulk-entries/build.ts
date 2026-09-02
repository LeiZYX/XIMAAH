import { resolveSyncedNameParts } from "@/lib/candidates/identity";
import { hasAmendmentBaseline } from "@/lib/board-submissions/baseline";
import {
  BULK_ENTRIES_BASELINE_LOCKED_MESSAGE,
  canCreateBulkEntriesBaseline,
} from "@/lib/board-submissions/baseline-rules";
import { BULK_SPEC_SLOTS } from "@/lib/board-submissions/bulk-entries/constants";
import { resolveBulkEntriesDemographics } from "@/lib/board-submissions/bulk-entries/identity";
import { entryKey, resolveBoardEntryCodes } from "@/lib/board-submissions/entry-utils";
import type {
  BulkEntriesCandidateRow,
  BulkEntriesFilePart,
  BulkEntriesPreview,
  BulkEntriesRegistrationTypeCounts,
  BulkEntriesSnapshotRow,
  BulkEntrySlot,
} from "@/lib/board-submissions/bulk-entries/types";
import type { Gender } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

function formatDobForEdexcel(value: Date | null): string | null {
  if (!value) return null;
  const day = String(value.getUTCDate()).padStart(2, "0");
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const year = value.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

function genderForEdexcel(gender: Gender | null): string | null {
  if (gender === "MALE") return "M";
  if (gender === "FEMALE") return "F";
  return null;
}

function chunkEntries(entries: BulkEntrySlot[]): BulkEntrySlot[][] {
  if (entries.length === 0) return [[]];
  const chunks: BulkEntrySlot[][] = [];
  for (let index = 0; index < entries.length; index += BULK_SPEC_SLOTS) {
    chunks.push(entries.slice(index, index + BULK_SPEC_SLOTS));
  }
  return chunks;
}

function validateCandidateRow(input: {
  uciNumber: string | null;
  firstName: string;
  lastName: string;
  gender: string | null;
  dateOfBirth: string | null;
  entries: BulkEntrySlot[];
}): string[] {
  const issues: string[] = [];
  if (!input.uciNumber?.trim()) issues.push("Missing UCI number");
  if (!input.firstName.trim()) issues.push("Missing first name");
  if (!input.lastName.trim()) issues.push("Missing last name");
  if (!input.gender) issues.push("Missing gender");
  if (!input.dateOfBirth) issues.push("Missing date of birth");
  if (input.entries.length === 0) issues.push("No exam entries");
  return issues;
}

function countRegistrationTypes(rows: BulkEntriesCandidateRow[]): BulkEntriesRegistrationTypeCounts {
  const counts: BulkEntriesRegistrationTypeCounts = {
    internal: 0,
    restricted: 0,
    external: 0,
  };

  for (const row of rows) {
    if (row.registrationTypes.includes("EXTERNAL")) {
      counts.external += 1;
      continue;
    }
    if (row.registrationTypes.includes("RESTRICTED_INTERNAL")) {
      counts.restricted += 1;
      continue;
    }
    counts.internal += 1;
  }

  return counts;
}

function candidateTypeLabel(candidateType: string | null | undefined): string {
  if (candidateType === "EXTERNAL") return "External";
  return "Internal";
}

export async function buildBulkEntriesPreview(
  registrationWindowId: string,
): Promise<BulkEntriesPreview | null> {
  const window = await prisma.registrationWindow.findUnique({
    where: { id: registrationWindowId },
    select: {
      id: true,
      title: true,
      examBoardId: true,
      examBoard: { select: { code: true } },
    },
  });
  if (!window) return null;

  const workspaces = await prisma.registrationWorkspace.findMany({
    where: {
      registrationWindowId,
      lockedAt: { not: null },
      OR: [{ candidateId: { not: null } }, { studentId: { not: null } }],
    },
    select: {
      candidateId: true,
      registrationType: true,
      student: {
        select: {
          studentProfile: { select: { gender: true, idCardNumber: true } },
          candidate: {
            select: {
              id: true,
              preferredEnglishName: true,
              firstName: true,
              lastName: true,
              givenNamePinyin: true,
              surnamePinyin: true,
              legalEnglishName: true,
              englishName: true,
              gender: true,
              dateOfBirth: true,
              idNumber: true,
              idDocumentNumber: true,
              candidateType: true,
              user: {
                select: {
                  studentProfile: { select: { gender: true, idCardNumber: true } },
                },
              },
              examIdentities: {
                where: { examBoardId: window.examBoardId, status: { not: "ARCHIVED" } },
                select: {
                  uciNumber: true,
                  candidateNumber: true,
                },
                take: 1,
              },
            },
          },
        },
      },
      candidate: {
        select: {
          id: true,
          preferredEnglishName: true,
          firstName: true,
          lastName: true,
          givenNamePinyin: true,
          surnamePinyin: true,
          legalEnglishName: true,
          englishName: true,
          gender: true,
          dateOfBirth: true,
          idNumber: true,
          idDocumentNumber: true,
          candidateType: true,
          user: {
            select: {
              studentProfile: { select: { gender: true, idCardNumber: true } },
            },
          },
          examIdentities: {
            where: { examBoardId: window.examBoardId, status: { not: "ARCHIVED" } },
            select: {
              uciNumber: true,
              candidateNumber: true,
            },
            take: 1,
          },
        },
      },
      registrations: {
        where: { status: { in: ["ACTIVE", "LOCKED"] } },
        select: {
          subject: {
            select: {
              code: true,
              qualification: { select: { code: true } },
            },
          },
          paper: { select: { code: true } },
        },
      },
    },
  });

  const candidateMap = new Map<string, BulkEntriesCandidateRow>();

  for (const workspace of workspaces) {
    const candidate = workspace.candidate ?? workspace.student?.candidate ?? null;
    const candidateId = workspace.candidateId ?? candidate?.id ?? null;
    if (!candidate || !candidateId) continue;

    const identity = candidate.examIdentities[0] ?? null;
    const names = resolveSyncedNameParts(candidate);
    const firstName = names.firstName;
    const lastName = names.lastName;
    const displayName =
      candidate.preferredEnglishName?.trim() ||
      [firstName, lastName].filter(Boolean).join(" ").trim() ||
      candidate.legalEnglishName?.trim() ||
      candidate.englishName?.trim() ||
      "—";
    const demographics = resolveBulkEntriesDemographics({
      gender: candidate.gender,
      dateOfBirth: candidate.dateOfBirth,
      idNumber: candidate.idNumber,
      idDocumentNumber: candidate.idDocumentNumber,
      candidateType: candidate.candidateType,
      user: candidate.user,
      studentProfile:
        workspace.student?.studentProfile ?? candidate.user?.studentProfile ?? null,
    });
    const gender = genderForEdexcel(demographics.gender);
    const dateOfBirth = formatDobForEdexcel(demographics.dateOfBirth);

    const entrySet = new Map<string, BulkEntrySlot>();
    for (const registration of workspace.registrations) {
      const entry = resolveBoardEntryCodes({
        qualificationCode: registration.subject.qualification.code,
        subjectCode: registration.subject.code,
        paperCode: registration.paper.code,
      });
      if (!entry) continue;
      entrySet.set(entryKey(entry), entry);
    }

    const existing = candidateMap.get(candidateId);
    if (existing) {
      const merged = new Map(existing.entries.map((item) => [entryKey(item), item]));
      for (const entry of entrySet.values()) {
        merged.set(entryKey(entry), entry);
      }
      existing.entries = [...merged.values()].sort((a, b) =>
        `${a.specification}:${a.specOption}`.localeCompare(`${b.specification}:${b.specOption}`),
      );
      if (!existing.registrationTypes.includes(workspace.registrationType)) {
        existing.registrationTypes.push(workspace.registrationType);
      }
      existing.gender = existing.gender ?? gender;
      existing.dateOfBirth = existing.dateOfBirth ?? dateOfBirth;
      existing.issues = validateCandidateRow({
        uciNumber: existing.uciNumber,
        firstName: existing.firstName,
        lastName: existing.lastName,
        gender: existing.gender,
        dateOfBirth: existing.dateOfBirth,
        entries: existing.entries,
      });
      existing.filePartCount = chunkEntries(existing.entries).length;
      continue;
    }

    const entries = [...entrySet.values()].sort((a, b) =>
      `${a.specification}:${a.specOption}`.localeCompare(`${b.specification}:${b.specOption}`),
    );
    const issues = validateCandidateRow({
      uciNumber: identity?.uciNumber ?? null,
      firstName,
      lastName,
      gender,
      dateOfBirth,
      entries,
    });

    candidateMap.set(candidateId, {
      candidateId,
      displayName,
      candidateType: candidateTypeLabel(candidate.candidateType),
      registrationTypes: [workspace.registrationType],
      uciNumber: identity?.uciNumber?.trim() || null,
      candidateNumber: identity?.candidateNumber?.trim() || null,
      firstName,
      lastName,
      gender,
      dateOfBirth,
      entries,
      issues,
      filePartCount: chunkEntries(entries).length,
    });
  }

  const rows = [...candidateMap.values()].sort((a, b) =>
    a.displayName.localeCompare(b.displayName),
  );
  const fileCount = rows.reduce((max, row) => Math.max(max, row.filePartCount), 1);
  const entryCount = rows.reduce((sum, row) => sum + row.entries.length, 0);
  const rowsReady = rows.length > 0 && rows.every((row) => row.issues.length === 0);
  const amendmentBaselineExists = await hasAmendmentBaseline(registrationWindowId);
  const blockingIssues = [...new Set(rows.flatMap((row) => row.issues))];
  if (amendmentBaselineExists) {
    blockingIssues.push(BULK_ENTRIES_BASELINE_LOCKED_MESSAGE);
  }

  return {
    registrationWindowId: window.id,
    registrationWindowTitle: window.title,
    examBoardCode: window.examBoard.code,
    candidateCount: rows.length,
    entryCount,
    fileCount,
    registrationTypeCounts: countRegistrationTypes(rows),
    rows,
    blockingIssues,
    canExport: rowsReady,
    canSubmit: canCreateBulkEntriesBaseline({ hasAmendmentBaseline: amendmentBaselineExists, rowsReady }),
  };
}

export function buildBulkEntriesFileParts(rows: BulkEntriesCandidateRow[]): BulkEntriesFilePart[] {
  const partCount = rows.reduce((max, row) => Math.max(max, row.filePartCount), 1);
  const parts: BulkEntriesFilePart[] = [];

  for (let partIndex = 0; partIndex < partCount; partIndex += 1) {
    const partRows = rows
      .map((row) => {
        const chunks = chunkEntries(row.entries);
        const chunk = chunks[partIndex];
        if (!chunk) return null;
        return {
          ...row,
          entries: chunk,
          filePartCount: row.filePartCount,
        };
      })
      .filter((row): row is BulkEntriesCandidateRow => row !== null);

    parts.push({
      partIndex: partIndex + 1,
      partCount,
      rowCount: partRows.length,
      rows: partRows,
    });
  }

  return parts;
}

export function buildBulkEntriesSnapshot(rows: BulkEntriesCandidateRow[]): BulkEntriesSnapshotRow[] {
  return rows.map((row) => ({
    candidateId: row.candidateId,
    entries: row.entries,
  }));
}
