import type { FeeEntryType } from "@/generated/prisma/enums";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";

export type PendingRepricePayload = {
  version: 1;
  workspaceId: string;
  targetEntryType: FeeEntryType;
  feeStageId: string | null;
  isLateRegistration: boolean;
  updateWorkspace: boolean;
  registrationUpdates: Array<{
    registrationId: string;
    entryType: FeeEntryType;
    feeStageId: string | null;
  }>;
  asOf: string;
};

export function isPendingRepricePayload(value: unknown): value is PendingRepricePayload {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    row.version === 1 &&
    typeof row.workspaceId === "string" &&
    typeof row.targetEntryType === "string" &&
    typeof row.updateWorkspace === "boolean" &&
    Array.isArray(row.registrationUpdates)
  );
}

type DbClient = PrismaClient | Prisma.TransactionClient;

export async function applyPendingRepricePayload(
  payload: PendingRepricePayload,
  db: DbClient,
) {
  for (const update of payload.registrationUpdates) {
    await db.studentExamRegistration.update({
      where: { id: update.registrationId },
      data: {
        entryType: update.entryType,
        feeStageId: update.feeStageId,
        entryTypeOverridden: false,
        entryTypeOverrideReason: null,
      },
    });
  }

  if (payload.updateWorkspace) {
    await db.registrationWorkspace.update({
      where: { id: payload.workspaceId },
      data: {
        entryType: payload.targetEntryType,
        feeStageId: payload.feeStageId,
        isLateRegistration: payload.isLateRegistration,
        entryTypeOverridden: false,
        entryTypeOverrideReason: null,
      },
    });
  }
}
