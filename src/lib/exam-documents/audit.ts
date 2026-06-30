import type { Prisma } from "@/generated/prisma/client";
import type { ExamDocumentAuditAction, ExamDocumentType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export async function createExamDocumentAuditLog(input: {
  action: ExamDocumentAuditAction;
  performedById: string;
  documentType?: ExamDocumentType;
  registrationWindowId?: string | null;
  examSessionId?: string | null;
  candidateId?: string | null;
  candidateCount?: number | null;
  metadata?: Record<string, unknown>;
  reason?: string | null;
}) {
  await prisma.examDocumentAuditLog.create({
    data: {
      action: input.action,
      performedById: input.performedById,
      documentType: input.documentType ?? null,
      registrationWindowId: input.registrationWindowId ?? null,
      examSessionId: input.examSessionId ?? null,
      candidateId: input.candidateId ?? null,
      candidateCount: input.candidateCount ?? null,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
      reason: input.reason ?? null,
    },
  });
}
