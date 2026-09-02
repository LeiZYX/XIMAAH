import { parseBaselineSnapshot } from "@/lib/board-submissions/baseline";
import {
  buildAmendmentSheetRowsFromSnapshots,
  type AmendmentDiffResult,
} from "@/lib/board-submissions/amendment/snapshot-diff";
import type { AmendmentSubmissionRecord } from "@/lib/board-submissions/amendment/types";
import { prisma } from "@/lib/prisma";

export async function buildAmendmentSubmissionHistory(
  registrationWindowId: string,
  examBoardId: string,
): Promise<AmendmentSubmissionRecord[]> {
  const baselines = await prisma.boardSubmissionBaseline.findMany({
    where: { registrationWindowId },
    orderBy: { version: "asc" },
    select: {
      version: true,
      kind: true,
      submittedAt: true,
      entrySnapshot: true,
      submittedBy: { select: { name: true } },
    },
  });

  const records: AmendmentSubmissionRecord[] = [];

  for (let index = 1; index < baselines.length; index += 1) {
    const baseline = baselines[index];
    if (baseline.kind !== "AMENDMENT") continue;

    const previous = baselines[index - 1];
    const diff = await buildAmendmentSheetRowsFromSnapshots({
      examBoardId,
      baselineRows: parseBaselineSnapshot(previous.entrySnapshot),
      currentRows: parseBaselineSnapshot(baseline.entrySnapshot),
    });

    records.push({
      baselineVersion: baseline.version,
      comparedAgainstVersion: previous.version,
      submittedAt: baseline.submittedAt.toISOString(),
      submittedByName: baseline.submittedBy?.name ?? null,
      addEntryCount: diff.addEntryCount,
      removeEntryCount: diff.removeEntryCount,
      addRowCount: diff.addRows.length,
      removeRowCount: diff.removeRows.length,
      canDownload:
        (diff.addEntryCount > 0 || diff.removeEntryCount > 0) &&
        [...diff.addRows, ...diff.removeRows].every((row) => row.issues.length === 0),
    });
  }

  return records.sort((a, b) => b.baselineVersion - a.baselineVersion);
}

export async function buildAmendmentExportForBaselineVersion(input: {
  registrationWindowId: string;
  baselineVersion: number;
}): Promise<
  | (AmendmentDiffResult & {
      registrationWindowTitle: string;
      examBoardCode: string;
    })
  | null
> {
  const window = await prisma.registrationWindow.findUnique({
    where: { id: input.registrationWindowId },
    select: {
      id: true,
      title: true,
      examBoardId: true,
      examBoard: { select: { code: true } },
    },
  });
  if (!window) return null;

  const baseline = await prisma.boardSubmissionBaseline.findFirst({
    where: {
      registrationWindowId: input.registrationWindowId,
      version: input.baselineVersion,
      kind: "AMENDMENT",
    },
    select: {
      version: true,
      entrySnapshot: true,
    },
  });
  if (!baseline) return null;

  const previous = await prisma.boardSubmissionBaseline.findFirst({
    where: {
      registrationWindowId: input.registrationWindowId,
      version: baseline.version - 1,
    },
    select: { entrySnapshot: true },
  });
  if (!previous) return null;

  const diff = await buildAmendmentSheetRowsFromSnapshots({
    examBoardId: window.examBoardId,
    baselineRows: parseBaselineSnapshot(previous.entrySnapshot),
    currentRows: parseBaselineSnapshot(baseline.entrySnapshot),
  });

  if (diff.addEntryCount === 0 && diff.removeEntryCount === 0) {
    return null;
  }

  const ready = [...diff.addRows, ...diff.removeRows].every((row) => row.issues.length === 0);
  if (!ready) return null;

  return {
    ...diff,
    registrationWindowTitle: window.title,
    examBoardCode: window.examBoard.code,
  };
}
