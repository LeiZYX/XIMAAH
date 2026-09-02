import { parseBaselineSnapshot } from "@/lib/board-submissions/baseline";
import {
  AMENDMENT_ADD_SLOTS,
  AMENDMENT_REMOVE_SLOTS,
} from "@/lib/board-submissions/amendment/constants";
import type { AmendmentPreview, AmendmentSheetRow } from "@/lib/board-submissions/amendment/types";
import { buildBulkEntriesPreview } from "@/lib/board-submissions/bulk-entries/build";
import type { BulkEntrySlot } from "@/lib/board-submissions/bulk-entries/types";
import { diffEntryLists } from "@/lib/board-submissions/entry-utils";
import { prisma } from "@/lib/prisma";

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

export async function buildAmendmentPreview(
  registrationWindowId: string,
): Promise<AmendmentPreview | null> {
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

  const baseline = await prisma.boardSubmissionBaseline.findFirst({
    where: { registrationWindowId },
    orderBy: { version: "desc" },
    select: {
      version: true,
      submittedAt: true,
      entrySnapshot: true,
    },
  });
  if (!baseline) {
    return {
      registrationWindowId: window.id,
      registrationWindowTitle: window.title,
      examBoardCode: window.examBoard.code,
      baselineVersion: 0,
      baselineSubmittedAt: "",
      addRowCount: 0,
      removeRowCount: 0,
      addEntryCount: 0,
      removeEntryCount: 0,
      changedCandidateCount: 0,
      addRows: [],
      removeRows: [],
      blockingIssues: ["Submit Bulk Entries baseline before generating amendments"],
      hasChanges: false,
      canExport: false,
      canSubmit: false,
    };
  }

  const currentPreview = await buildBulkEntriesPreview(registrationWindowId);
  if (!currentPreview) return null;

  const baselineRows = parseBaselineSnapshot(baseline.entrySnapshot);
  const baselineMap = new Map(baselineRows.map((row) => [row.candidateId, row.entries]));
  const currentMap = new Map(currentPreview.rows.map((row) => [row.candidateId, row]));

  const candidateIds = new Set([...baselineMap.keys(), ...currentMap.keys()]);
  const centreNumbers = new Map<string, string | null>();

  if (candidateIds.size > 0) {
    const identities = await prisma.candidateExamIdentity.findMany({
      where: {
        candidateId: { in: [...candidateIds] },
        examBoardId: window.examBoardId,
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
    const currentRow = currentMap.get(candidateId);
    const currentEntries = currentRow?.entries ?? [];
    const { adds, removes } = diffEntryLists(baselineEntries, currentEntries);

    if (adds.length === 0 && removes.length === 0) continue;
    changedCandidateIds.add(candidateId);

    const displayName = currentRow?.displayName ?? "—";
    const candidateNumber = currentRow?.candidateNumber ?? null;
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

  const allRows = [...addRows, ...removeRows];
  const blockingIssues = [...new Set(allRows.flatMap((row) => row.issues))];
  const hasChanges = addEntryCount > 0 || removeEntryCount > 0;
  const ready =
    hasChanges &&
    allRows.length > 0 &&
    allRows.every((row) => row.issues.length === 0);

  return {
    registrationWindowId: window.id,
    registrationWindowTitle: window.title,
    examBoardCode: window.examBoard.code,
    baselineVersion: baseline.version,
    baselineSubmittedAt: baseline.submittedAt.toISOString(),
    addRowCount: addRows.length,
    removeRowCount: removeRows.length,
    addEntryCount,
    removeEntryCount,
    changedCandidateCount: changedCandidateIds.size,
    addRows,
    removeRows,
    blockingIssues,
    hasChanges,
    canExport: ready,
    canSubmit: ready,
  };
}
