import type { Prisma } from "@/generated/prisma/client";
import { buildAmendmentPreview } from "@/lib/board-submissions/amendment/build";
import { buildBulkEntriesPreview, buildBulkEntriesSnapshot } from "@/lib/board-submissions/bulk-entries/build";
import { prisma } from "@/lib/prisma";

export async function submitAmendmentBaseline(input: {
  registrationWindowId: string;
  submittedByUserId: string;
  notes?: string | null;
}) {
  const preview = await buildAmendmentPreview(input.registrationWindowId);
  if (!preview) {
    throw new Error("Registration window not found");
  }
  if (!preview.hasChanges) {
    throw new Error("No changes since the latest baseline");
  }
  if (!preview.canSubmit) {
    throw new Error("Resolve validation issues before marking as submitted");
  }

  const currentPreview = await buildBulkEntriesPreview(input.registrationWindowId);
  if (!currentPreview) {
    throw new Error("Registration window not found");
  }

  const latest = await prisma.boardSubmissionBaseline.findFirst({
    where: { registrationWindowId: input.registrationWindowId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const version = (latest?.version ?? 0) + 1;
  const snapshot = buildBulkEntriesSnapshot(currentPreview.rows);

  const baseline = await prisma.boardSubmissionBaseline.create({
    data: {
      registrationWindowId: input.registrationWindowId,
      version,
      kind: "AMENDMENT",
      submittedByUserId: input.submittedByUserId,
      candidateCount: currentPreview.candidateCount,
      entryCount: currentPreview.entryCount,
      fileCount: 1,
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
