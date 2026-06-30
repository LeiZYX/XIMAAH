import type { CandidateAuditAction } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export async function createCandidateAuditLog(input: {
  candidateId: string;
  action: CandidateAuditAction;
  performedById: string;
  metadata?: Prisma.InputJsonValue;
}) {
  return prisma.candidateAuditLog.create({
    data: {
      candidateId: input.candidateId,
      action: input.action,
      performedById: input.performedById,
      metadata: input.metadata,
    },
  });
}
