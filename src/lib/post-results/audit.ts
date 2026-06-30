import type {
  FeeScheduleServiceType,
  PostResultsAuditAction,
} from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

export interface PostResultsAuditInput {
  action: PostResultsAuditAction;
  performedByUserId: string;
  candidateId?: string | null;
  examBoardId?: string | null;
  examSeriesId?: string | null;
  registrationWindowId?: string | null;
  reviewWindowId?: string | null;
  serviceType?: FeeScheduleServiceType | null;
  reason?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function logPostResultsAudit(input: PostResultsAuditInput) {
  return prisma.postResultsAuditLog.create({
    data: {
      action: input.action,
      performedByUserId: input.performedByUserId,
      candidateId: input.candidateId ?? undefined,
      examBoardId: input.examBoardId ?? undefined,
      examSeriesId: input.examSeriesId ?? undefined,
      registrationWindowId: input.registrationWindowId ?? undefined,
      reviewWindowId: input.reviewWindowId ?? undefined,
      serviceType: input.serviceType ?? undefined,
      reason: input.reason ?? undefined,
      notes: input.notes ?? undefined,
      metadata: input.metadata ? JSON.stringify(input.metadata) : undefined,
    },
  });
}

export const POST_RESULTS_AUDIT_LABELS: Record<PostResultsAuditAction, string> = {
  REVIEW_WINDOW_CREATED: "Review window created",
  REVIEW_WINDOW_UPDATED: "Review window updated",
  REVIEW_WINDOW_LOCKED: "Review window locked",
  REVIEW_SERVICE_ENABLED: "Review service enabled",
  REVIEW_SERVICE_DISABLED: "Review service disabled",
  REVIEW_REQUEST_CREATED: "Review request created",
  REVIEW_REQUEST_UPDATED: "Review request updated",
  REVIEW_REQUEST_SUBMITTED: "Review request submitted",
  CASH_IN_REQUEST_CREATED: "Cash-in request created",
  ACCESS_TO_SCRIPT_REQUEST_CREATED: "Access to script request created",
  CERTIFICATE_REQUEST_CREATED: "Certificate request created",
  FEE_SCHEDULE_VERSION_CREATED: "Fee schedule version created",
  REGISTRATION_FEE_STATEMENT_GENERATED: "Registration fee statement generated",
  POST_RESULTS_FEE_STATEMENT_GENERATED: "Post-results fee statement generated",
};
