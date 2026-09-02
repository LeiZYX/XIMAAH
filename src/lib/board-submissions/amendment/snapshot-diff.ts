import { resolveSyncedNameParts } from "@/lib/candidates/identity";
import {
  AMENDMENT_ADD_SLOTS,
  AMENDMENT_REMOVE_SLOTS,
} from "@/lib/board-submissions/amendment/constants";
import type { AmendmentSheetRow } from "@/lib/board-submissions/amendment/types";
import type { BulkEntriesSnapshotRow } from "@/lib/board-submissions/bulk-entries/types";
import type { BulkEntrySlot } from "@/lib/board-submissions/bulk-entries/types";
import { diffEntryLists } from "@/lib/board-submissions/entry-utils";
import { prisma } from "@/lib/prisma";

export interface AmendmentDiffResult {
  addRows: AmendmentSheetRow[];
  removeRows: AmendmentSheetRow[];
  addEntryCount: number;
  removeEntryCount: number;
  changedCandidateCount: number;
}

function chunkEntries(entries: BulkEntrySlot[], size: number): BulkEntrySlot[][] {
  if (entries.length === 0) return [];
  const chunks: BulkEntrySlot[][] = [];
  for (let index = 0; index < entries.length; index += size) {
    chunks.push(entries.slice(index, index + size));
  }
  return chunks;
}

function validateAmendmentRow(input: {
  centreNumber: string | null;
  candidateNumber: string | null;
  displayName: string;
  entries: BulkEntrySlot[];
}): string[] {
  const issues: string[] = [];
  if (!input.centreNumber?.trim()) issues.push("Missing centre number");
  if (!input.candidateNumber?.trim()) issues.push("Missing candidate number");
  if (!input.displayName.trim()) issues.push("Missing candidate name");
  if (input.entries.length === 0) issues.push("No amendment entries");
  return issues;
}

function buildSheetRows(input: {
  candidateId: string;
  displayName: string;
  centreNumber: string | null;
  candidateNumber: string | null;
  entries: BulkEntrySlot[];
  chunkSize: number;
}): AmendmentSheetRow[] {
  const chunks = chunkEntries(input.entries, input.chunkSize);
  return chunks.map((entries) => {
    const issues = validateAmendmentRow({
      centreNumber: input.centreNumber,
      candidateNumber: input.candidateNumber,
      displayName: input.displayName,
      entries,
    });
    return {
      candidateId: input.candidateId,
      displayName: input.displayName,
      centreNumber: input.centreNumber,
      candidateNumber: input.candidateNumber,
      entries,
      issues,
    };
  });
}

async function loadAmendmentCandidateContext(
  candidateIds: string[],
  examBoardId: string,
): Promise<
  Map<string, { displayName: string; candidateNumber: string | null; centreNumber: string | null }>
> {
  const context = new Map<
    string,
    { displayName: string; candidateNumber: string | null; centreNumber: string | null }
  >();
  if (candidateIds.length === 0) return context;

  const [candidates, identities] = await Promise.all([
    prisma.candidate.findMany({
      where: { id: { in: candidateIds } },
      select: {
        id: true,
        preferredEnglishName: true,
        firstName: true,
        lastName: true,
        legalEnglishName: true,
        englishName: true,
        givenNamePinyin: true,
        surnamePinyin: true,
      },
    }),
    prisma.candidateExamIdentity.findMany({
      where: {
        candidateId: { in: candidateIds },
        examBoardId,
        status: { not: "ARCHIVED" },
      },
      select: { candidateId: true, centreNumber: true, candidateNumber: true },
    }),
  ]);

  const identityByCandidate = new Map(
    identities.map((identity) => [identity.candidateId, identity]),
  );

  for (const candidate of candidates) {
    const names = resolveSyncedNameParts(candidate);
    const displayName =
      candidate.preferredEnglishName?.trim() ||
      [names.firstName, names.lastName].filter(Boolean).join(" ").trim() ||
      candidate.legalEnglishName?.trim() ||
      candidate.englishName?.trim() ||
      "—";
    const identity = identityByCandidate.get(candidate.id);
    context.set(candidate.id, {
      displayName,
      candidateNumber: identity?.candidateNumber?.trim() || null,
      centreNumber: identity?.centreNumber?.trim() || null,
    });
  }

  return context;
}

export async function buildAmendmentSheetRowsFromSnapshots(input: {
  examBoardId: string;
  baselineRows: BulkEntriesSnapshotRow[];
  currentRows: BulkEntriesSnapshotRow[];
  liveCandidateDetails?: Map<
    string,
    { displayName: string; candidateNumber: string | null; centreNumber?: string | null }
  >;
}): Promise<AmendmentDiffResult> {
  const baselineMap = new Map(input.baselineRows.map((row) => [row.candidateId, row.entries]));
  const currentMap = new Map(input.currentRows.map((row) => [row.candidateId, row.entries]));
  const candidateIds = new Set([...baselineMap.keys(), ...currentMap.keys()]);

  let candidateContext: Map<
    string,
    { displayName: string; candidateNumber: string | null; centreNumber?: string | null }
  >;

  if (input.liveCandidateDetails) {
    candidateContext = input.liveCandidateDetails;
  } else {
    candidateContext = await loadAmendmentCandidateContext([...candidateIds], input.examBoardId);
  }

  const centreNumbers = new Map<string, string | null>();
  for (const [candidateId, details] of candidateContext) {
    centreNumbers.set(candidateId, details.centreNumber?.trim() || null);
  }
  if (!input.liveCandidateDetails && candidateIds.size > 0) {
    const identities = await prisma.candidateExamIdentity.findMany({
      where: {
        candidateId: { in: [...candidateIds] },
        examBoardId: input.examBoardId,
        status: { not: "ARCHIVED" },
      },
      select: { candidateId: true, centreNumber: true },
    });
    for (const identity of identities) {
      centreNumbers.set(identity.candidateId, identity.centreNumber?.trim() || null);
    }
  }

  const addRows: AmendmentSheetRow[] = [];
  const removeRows: AmendmentSheetRow[] = [];
  let addEntryCount = 0;
  let removeEntryCount = 0;
  const changedCandidateIds = new Set<string>();

  for (const candidateId of candidateIds) {
    const baselineEntries = baselineMap.get(candidateId) ?? [];
    const currentEntries = currentMap.get(candidateId) ?? [];
    const { adds, removes } = diffEntryLists(baselineEntries, currentEntries);

    if (adds.length === 0 && removes.length === 0) continue;
    changedCandidateIds.add(candidateId);

    const details = candidateContext.get(candidateId);
    const displayName = details?.displayName ?? "—";
    const candidateNumber = details?.candidateNumber ?? null;
    const centreNumber = centreNumbers.get(candidateId) ?? null;

    if (adds.length > 0) {
      addEntryCount += adds.length;
      addRows.push(
        ...buildSheetRows({
          candidateId,
          displayName,
          centreNumber,
          candidateNumber,
          entries: adds,
          chunkSize: AMENDMENT_ADD_SLOTS,
        }),
      );
    }

    if (removes.length > 0) {
      removeEntryCount += removes.length;
      removeRows.push(
        ...buildSheetRows({
          candidateId,
          displayName,
          centreNumber,
          candidateNumber,
          entries: removes,
          chunkSize: AMENDMENT_REMOVE_SLOTS,
        }),
      );
    }
  }

  addRows.sort((a, b) =>
    `${a.displayName}:${a.entries.map((entry) => entry.specification).join(",")}`.localeCompare(
      `${b.displayName}:${b.entries.map((entry) => entry.specification).join(",")}`,
    ),
  );
  removeRows.sort((a, b) =>
    `${a.displayName}:${a.entries.map((entry) => entry.specification).join(",")}`.localeCompare(
      `${b.displayName}:${b.entries.map((entry) => entry.specification).join(",")}`,
    ),
  );

  return {
    addRows,
    removeRows,
    addEntryCount,
    removeEntryCount,
    changedCandidateCount: changedCandidateIds.size,
  };
}
