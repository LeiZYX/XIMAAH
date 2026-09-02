import { resolveSyncedNameParts } from "@/lib/candidates/identity";
import { BULK_SPEC_SLOTS } from "@/lib/board-submissions/bulk-entries/constants";
import type {
  BulkEntriesCandidateRow,
  BulkEntriesFilePart,
  BulkEntriesPreview,
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

function entryKey(entry: BulkEntrySlot): string {
  return `${entry.specification}::${entry.specOption}`;
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
      candidateId: { not: null },
    },
    select: {
      candidateId: true,
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
    const candidate = workspace.candidate;
    const candidateId = workspace.candidateId;
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

    const entrySet = new Map<string, BulkEntrySlot>();
    for (const registration of workspace.registrations) {
      const specification =
        registration.subject.qualification.code?.trim() || registration.subject.code.trim();
      const specOption = registration.paper.code.trim();
      if (!specification || !specOption) continue;
      const entry = { specification, specOption };
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
    const gender = genderForEdexcel(candidate.gender);
    const dateOfBirth = formatDobForEdexcel(candidate.dateOfBirth);
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
  const blockingIssues = [...new Set(rows.flatMap((row) => row.issues))];

  return {
    registrationWindowId: window.id,
    registrationWindowTitle: window.title,
    examBoardCode: window.examBoard.code,
    candidateCount: rows.length,
    entryCount,
    fileCount,
    rows,
    blockingIssues,
    canExport: rows.length > 0 && rows.every((row) => row.issues.length === 0),
    canSubmit: rows.length > 0 && rows.every((row) => row.issues.length === 0),
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
