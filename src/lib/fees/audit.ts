import type { FeeAuditAction } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export async function createFeeAuditLog(params: {
  action: FeeAuditAction;
  performedByUserId: string;
  registrationWindowId?: string | null;
  metadata?: unknown;
  note?: string;
}) {
  return prisma.feeAuditLog.create({
    data: {
      action: params.action,
      performedByUserId: params.performedByUserId,
      registrationWindowId: params.registrationWindowId ?? null,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      note: params.note ?? null,
    },
  });
}
