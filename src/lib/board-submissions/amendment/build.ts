import { parseBaselineSnapshot } from "@/lib/board-submissions/baseline";
import { buildAmendmentSubmissionHistory } from "@/lib/board-submissions/amendment/history";
import { buildAmendmentSheetRowsFromSnapshots } from "@/lib/board-submissions/amendment/snapshot-diff";
import type { AmendmentPreview, AmendmentSheetRow } from "@/lib/board-submissions/amendment/types";
import { buildBulkEntriesPreview } from "@/lib/board-submissions/bulk-entries/build";
import type { BulkEntrySlot } from "@/lib/board-submissions/bulk-entries/types";
import { prisma } from "@/lib/prisma";

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

function applyCentreNumbers(
  rows: AmendmentSheetRow[],
  centreNumbers: Map<string, string | null>,
): AmendmentSheetRow[] {
  return rows.map((row) => ({
    ...row,
    centreNumber: centreNumbers.get(row.candidateId) ?? row.centreNumber,
    issues: validateAmendmentRow({
      centreNumber: centreNumbers.get(row.candidateId) ?? row.centreNumber,
      candidateNumber: row.candidateNumber,
      displayName: row.displayName,
      entries: row.entries,
    }),
  }));
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

  const submissionHistory = await buildAmendmentSubmissionHistory(
    registrationWindowId,
    window.examBoardId,
  );

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
      submissionHistory,
    };
  }

  const currentPreview = await buildBulkEntriesPreview(registrationWindowId);
  if (!currentPreview) return null;

  const liveCandidateDetails = new Map(
    currentPreview.rows.map((row) => [
      row.candidateId,
      {
        displayName: row.displayName,
        candidateNumber: row.candidateNumber,
        centreNumber: null as string | null,
      },
    ]),
  );

  const diff = await buildAmendmentSheetRowsFromSnapshots({
    examBoardId: window.examBoardId,
    baselineRows: parseBaselineSnapshot(baseline.entrySnapshot),
    currentRows: currentPreview.rows.map((row) => ({
      candidateId: row.candidateId,
      entries: row.entries,
    })),
    liveCandidateDetails,
  });

  const centreNumbers = new Map<string, string | null>();
  if (diff.addRows.length > 0 || diff.removeRows.length > 0) {
    const candidateIds = [
      ...new Set([...diff.addRows, ...diff.removeRows].map((row) => row.candidateId)),
    ];
    const identities = await prisma.candidateExamIdentity.findMany({
      where: {
        candidateId: { in: candidateIds },
        examBoardId: window.examBoardId,
        status: { not: "ARCHIVED" },
      },
      select: { candidateId: true, centreNumber: true },
    });
    for (const identity of identities) {
      centreNumbers.set(identity.candidateId, identity.centreNumber?.trim() || null);
    }
  }

  const addRows = applyCentreNumbers(diff.addRows, centreNumbers);
  const removeRows = applyCentreNumbers(diff.removeRows, centreNumbers);
  const allRows = [...addRows, ...removeRows];
  const blockingIssues = [...new Set(allRows.flatMap((row) => row.issues))];
  const hasChanges = diff.addEntryCount > 0 || diff.removeEntryCount > 0;
  const ready =
    hasChanges && allRows.length > 0 && allRows.every((row) => row.issues.length === 0);

  return {
    registrationWindowId: window.id,
    registrationWindowTitle: window.title,
    examBoardCode: window.examBoard.code,
    baselineVersion: baseline.version,
    baselineSubmittedAt: baseline.submittedAt.toISOString(),
    addRowCount: addRows.length,
    removeRowCount: removeRows.length,
    addEntryCount: diff.addEntryCount,
    removeEntryCount: diff.removeEntryCount,
    changedCandidateCount: diff.changedCandidateCount,
    addRows,
    removeRows,
    blockingIssues,
    hasChanges,
    canExport: ready,
    canSubmit: ready,
    submissionHistory,
  };
}
