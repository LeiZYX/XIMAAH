import type { Prisma } from "@/generated/prisma/client";
import { BULK_ENTRIES_BASELINE_LOCKED_MESSAGE } from "@/lib/board-submissions/baseline-rules";
import { buildBulkEntriesPreview, buildBulkEntriesSnapshot } from "@/lib/board-submissions/bulk-entries/build";
import { prisma } from "@/lib/prisma";

export async function submitBulkEntriesBaseline(input: {
  registrationWindowId: string;
  submittedByUserId: string;
  notes?: string | null;
}) {
  const preview = await buildBulkEntriesPreview(input.registrationWindowId);
  if (!preview) {
    throw new Error("Registration window not found");
  }
  if (!preview.canSubmit) {
    if (preview.blockingIssues.includes(BULK_ENTRIES_BASELINE_LOCKED_MESSAGE)) {
      throw new Error(BULK_ENTRIES_BASELINE_LOCKED_MESSAGE);
    }
    throw new Error("Resolve validation issues before marking as submitted");
  }

  const latest = await prisma.boardSubmissionBaseline.findFirst({
    where: { registrationWindowId: input.registrationWindowId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const version = (latest?.version ?? 0) + 1;
  const snapshot = buildBulkEntriesSnapshot(preview.rows);

  const baseline = await prisma.boardSubmissionBaseline.create({
    data: {
      registrationWindowId: input.registrationWindowId,
      version,
      kind: "BULK_ENTRIES",
      submittedByUserId: input.submittedByUserId,
      candidateCount: preview.candidateCount,
      entryCount: preview.entryCount,
      fileCount: preview.fileCount,
      notes: input.notes?.trim() || null,
      entrySnapshot: snapshot as unknown as Prisma.InputJsonValue,
    },
    include: {
      submittedBy: { select: { id: true, name: true } },
    },
  });

  return {
    baseline,
    preview,
  };
}
