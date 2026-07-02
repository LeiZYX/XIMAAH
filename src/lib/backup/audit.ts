import type { UserAuditAction } from "@/generated/prisma/enums";
import { logUserAudit } from "@/lib/users/audit";

export async function logBackupAudit(input: {
  action: UserAuditAction;
  performedById: string;
  metadata?: Record<string, unknown>;
}) {
  await logUserAudit({
    action: input.action,
    performedById: input.performedById,
    targetUserId: null,
    metadata: {
      ...input.metadata,
      timestamp: new Date().toISOString(),
    },
  });
}
