import type { Prisma } from "@/generated/prisma/client";
import type { UserAuditAction } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export async function logUserAudit(input: {
  action: UserAuditAction;
  performedById: string;
  targetUserId?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  await prisma.userAuditLog.create({
    data: {
      action: input.action,
      performedById: input.performedById,
      targetUserId: input.targetUserId ?? null,
      metadata: input.metadata,
    },
  });
}
