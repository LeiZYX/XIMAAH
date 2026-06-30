import type { Prisma } from "@/generated/prisma/client";
import type { RegistrationAuditAction } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { hasWorkspaceSchema } from "@/lib/registrations/schema-capabilities";

type AuditClient = Prisma.TransactionClient | typeof prisma;

const LEGACY_AUDIT_ACTION: Partial<Record<RegistrationAuditAction, RegistrationAuditAction>> = {
  STUDENT_ADD: "ADD",
  STUDENT_REMOVE: "CANCEL",
  SYSTEM_LOCK: "LOCK",
  EO_ADD_AFTER_LOCK: "ADMIN_ADJUST",
  EO_REMOVE_AFTER_LOCK: "ADMIN_ADJUST",
  EO_REPLACE_AFTER_LOCK: "ADMIN_ADJUST",
  ADMIN_ADD_AFTER_LOCK: "ADMIN_ADJUST",
  ADMIN_REMOVE_AFTER_LOCK: "ADMIN_ADJUST",
  ADMIN_REPLACE_AFTER_LOCK: "ADMIN_ADJUST",
  TEACHER_CHANGE_REQUEST: "UPDATE",
  TEACHER_REQUEST_APPROVED: "UPDATE",
  TEACHER_REQUEST_REJECTED: "UPDATE",
  TEACHER_LATE_REGISTRATION_REQUEST: "UPDATE",
  TEACHER_LATE_REGISTRATION_APPROVED: "UPDATE",
  TEACHER_LATE_REGISTRATION_REJECTED: "UPDATE",
  EO_LATE_REGISTRATION_CREATED: "ADMIN_ADJUST",
  ADMIN_LATE_REGISTRATION_CREATED: "ADMIN_ADJUST",
  EO_ASSISTED_REGISTRATION_CREATED: "ADMIN_ADJUST",
  ADMIN_ASSISTED_REGISTRATION_CREATED: "ADMIN_ADJUST",
  EO_OFFICE_ONLY_REGISTRATION_CREATED: "ADMIN_ADJUST",
  ADMIN_OFFICE_ONLY_REGISTRATION_CREATED: "ADMIN_ADJUST",
  EO_RESTRICTED_REGISTRATION_CREATED: "ADMIN_ADJUST",
  ADMIN_RESTRICTED_REGISTRATION_CREATED: "ADMIN_ADJUST",
  RESTRICTED_REGISTRATION_UPDATED: "ADMIN_ADJUST",
  RESTRICTED_REGISTRATION_CANCELLED: "ADMIN_ADJUST",
  EO_POST_LOCK_ADJUSTMENT: "ADMIN_ADJUST",
  ADMIN_POST_LOCK_ADJUSTMENT: "ADMIN_ADJUST",
  STUDENT_REGISTRATION_SUBMITTED: "STUDENT_SUBMIT",
  EXTERNAL_CANDIDATE_REGISTRATION_CREATED: "ADMIN_ADJUST",
};

export function serializeAuditValue(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  return JSON.stringify(value);
}

export async function createRegistrationAuditLog(
  params: {
    registrationWorkspaceId?: string | null;
    candidateId?: string | null;
    studentId?: string | null;
    registrationId?: string | null;
    examSessionId: string | null;
    action: RegistrationAuditAction;
    performedById: string;
    performedByRole?: string | null;
    beforeValue?: unknown;
    afterValue?: unknown;
    reason?: string;
    note?: string;
    registrationSource?: string | null;
    visibility?: string | null;
    billingScope?: string | null;
    assessmentHubCandidateNumberSnapshot?: string | null;
    candidateTypeSnapshot?: string | null;
    registrationStageId?: string | null;
    feeStageId?: string | null;
    entryType?: string | null;
    registrationWindowId?: string | null;
  },
  client: AuditClient = prisma,
) {
  const workspaceReady = await hasWorkspaceSchema();
  const action = workspaceReady
    ? params.action
    : (LEGACY_AUDIT_ACTION[params.action] ?? params.action);

  const data: Record<string, unknown> = {
    studentId: params.studentId ?? null,
    registrationId: params.registrationId ?? null,
    examSessionId: params.examSessionId,
    action,
    performedById: params.performedById,
    beforeValue: serializeAuditValue(params.beforeValue),
    afterValue: serializeAuditValue(params.afterValue),
    note: params.note ?? params.reason ?? null,
  };

  if (workspaceReady) {
    data.registrationWorkspaceId = params.registrationWorkspaceId ?? null;
    data.candidateId = params.candidateId ?? null;
    data.performedByRole = params.performedByRole ?? null;
    data.reason = params.reason ?? null;
    data.registrationSource = params.registrationSource ?? null;
    data.visibility = params.visibility ?? null;
    data.billingScope = params.billingScope ?? null;
    data.assessmentHubCandidateNumberSnapshot =
      params.assessmentHubCandidateNumberSnapshot ?? null;
    data.candidateTypeSnapshot = params.candidateTypeSnapshot ?? null;
    data.feeStageId = params.feeStageId ?? params.registrationStageId ?? null;
    data.entryType = params.entryType ?? null;
    data.registrationWindowId = params.registrationWindowId ?? null;
  }

  return client.registrationAuditLog.create({
    data: data as never,
  });
}

export function registrationAuditSnapshot(registration: {
  id: string;
  status: string;
  studentNameSnapshot: string;
  studentNoSnapshot: string;
  gradeSnapshot: string;
  classNameSnapshot: string;
  emailSnapshot: string | null;
  phoneSnapshot: string | null;
  registrationWindowId: string;
  lockedAt?: Date | null;
  cancelledAt?: Date | null;
  registrationSource?: string;
  visibility?: string;
  billingScope?: string;
  reason?: string | null;
  assessmentHubCandidateNumberSnapshot?: string | null;
  candidateTypeSnapshot?: string | null;
}) {
  return {
    id: registration.id,
    status: registration.status,
    studentNameSnapshot: registration.studentNameSnapshot,
    studentNoSnapshot: registration.studentNoSnapshot,
    gradeSnapshot: registration.gradeSnapshot,
    classNameSnapshot: registration.classNameSnapshot,
    emailSnapshot: registration.emailSnapshot,
    phoneSnapshot: registration.phoneSnapshot,
    registrationWindowId: registration.registrationWindowId,
    lockedAt: registration.lockedAt?.toISOString() ?? null,
    cancelledAt: registration.cancelledAt?.toISOString() ?? null,
    registrationSource: registration.registrationSource ?? null,
    visibility: registration.visibility ?? null,
    billingScope: registration.billingScope ?? null,
    reason: registration.reason ?? null,
    assessmentHubCandidateNumberSnapshot:
      registration.assessmentHubCandidateNumberSnapshot ?? null,
    candidateTypeSnapshot: registration.candidateTypeSnapshot ?? null,
  };
}
