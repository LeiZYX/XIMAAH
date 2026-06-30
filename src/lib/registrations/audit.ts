import type { Prisma } from "@/generated/prisma/client";
import type { RegistrationAuditAction } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import {
  assertRegistrationAuditReason,
  buildRegistrationAuditPayload,
  formatRegistrationAuditNote,
  loadRegistrationAuditContext,
  wrapAuditDetail,
} from "@/lib/registrations/audit-payload";
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
  INTERNAL_NORMAL_REGISTRATION_CREATED: "ADMIN_ADJUST",
  INTERNAL_NORMAL_REGISTRATION_UPDATED: "ADMIN_ADJUST",
  RESTRICTED_INTERNAL_REGISTRATION_CREATED: "ADMIN_ADJUST",
  RESTRICTED_INTERNAL_REGISTRATION_UPDATED: "ADMIN_ADJUST",
  RESTRICTED_REGISTRATION_UPDATED: "ADMIN_ADJUST",
  RESTRICTED_REGISTRATION_CANCELLED: "ADMIN_ADJUST",
  EO_POST_LOCK_ADJUSTMENT: "ADMIN_ADJUST",
  ADMIN_POST_LOCK_ADJUSTMENT: "ADMIN_ADJUST",
  STUDENT_REGISTRATION_SUBMITTED: "STUDENT_SUBMIT",
  EXTERNAL_CANDIDATE_REGISTRATION_CREATED: "ADMIN_ADJUST",
  EXTERNAL_REGISTRATION_CREATED: "ADMIN_ADJUST",
  EXTERNAL_REGISTRATION_UPDATED: "ADMIN_ADJUST",
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
    registrationType?: string | null;
    registrationNumber?: string | null;
    feeStatementNumber?: string | null;
    issueNumber?: string | null;
    assessmentHubCandidateNumberSnapshot?: string | null;
    candidateTypeSnapshot?: string | null;
    registrationStageId?: string | null;
    feeStageId?: string | null;
    entryType?: string | null;
    registrationWindowId?: string | null;
    performedAt?: Date;
    skipReasonCheck?: boolean;
  },
  client: AuditClient = prisma,
) {
  const workspaceReady = await hasWorkspaceSchema();
  const action = workspaceReady
    ? params.action
    : (LEGACY_AUDIT_ACTION[params.action] ?? params.action);

  const workspaceContext = params.registrationWorkspaceId
    ? await loadRegistrationAuditContext(params.registrationWorkspaceId, client)
    : null;

  const registrationType =
    params.registrationType ?? workspaceContext?.registrationType ?? "INTERNAL_NORMAL";
  const registrationNumber =
    params.registrationNumber ?? workspaceContext?.registrationNumber ?? null;
  const issueNumber = params.issueNumber ?? workspaceContext?.issueNumber ?? null;
  const feeStatementNumber =
    params.feeStatementNumber ?? workspaceContext?.feeStatementNumber ?? null;
  const candidateId = params.candidateId ?? workspaceContext?.candidateId ?? null;
  const candidateType =
    params.candidateTypeSnapshot ?? workspaceContext?.candidateType ?? null;
  const registrationSource =
    params.registrationSource ?? workspaceContext?.registrationSource ?? null;
  const visibility = params.visibility ?? workspaceContext?.visibility ?? null;
  const billingScope = params.billingScope ?? workspaceContext?.billingScope ?? null;
  const reason = params.reason ?? null;
  const performedAt = params.performedAt ?? new Date();

  if (workspaceReady && !params.skipReasonCheck) {
    assertRegistrationAuditReason(registrationType, action, reason);
  }

  const payload = buildRegistrationAuditPayload({
    registrationType,
    registrationNumber,
    feeStatementNumber,
    issueNumber,
    candidateId,
    candidateType,
    visibility,
    billingScope,
    registrationSource,
    performedByUserId: params.performedById,
    performedByRole: params.performedByRole ?? null,
    reason,
    performedAt,
  });

  const note = params.note
    ? formatRegistrationAuditNote(registrationType, params.note)
    : auditTypeMarkerNote(registrationType, action);

  const data: Record<string, unknown> = {
    studentId: params.studentId ?? null,
    registrationId: params.registrationId ?? null,
    examSessionId: params.examSessionId,
    action,
    performedById: params.performedById,
    beforeValue: serializeAuditValue(
      params.beforeValue === undefined ? null : wrapAuditDetail(payload, params.beforeValue),
    ),
    afterValue: serializeAuditValue(
      params.afterValue === undefined ? wrapAuditDetail(payload, null) : wrapAuditDetail(payload, params.afterValue),
    ),
    note: note ?? params.reason ?? null,
    performedAt,
  };

  if (workspaceReady) {
    data.registrationWorkspaceId = params.registrationWorkspaceId ?? null;
    data.candidateId = candidateId;
    data.performedByRole = params.performedByRole ?? null;
    data.reason = reason;
    data.registrationSource = registrationSource;
    data.visibility = visibility;
    data.billingScope = billingScope;
    data.registrationType = registrationType;
    data.registrationNumber = registrationNumber;
    data.feeStatementNumber = feeStatementNumber;
    data.issueNumber = issueNumber;
    data.assessmentHubCandidateNumberSnapshot =
      params.assessmentHubCandidateNumberSnapshot ?? null;
    data.candidateTypeSnapshot = candidateType;
    data.feeStageId = params.feeStageId ?? params.registrationStageId ?? null;
    data.entryType = params.entryType ?? null;
    data.registrationWindowId = params.registrationWindowId ?? null;
  }

  return client.registrationAuditLog.create({
    data: data as never,
  });
}

function auditTypeMarkerNote(
  registrationType: string | null | undefined,
  action: RegistrationAuditAction,
): string | null {
  if (registrationType === "RESTRICTED_INTERNAL") {
    return `Restricted Internal · ${action}`;
  }
  if (registrationType === "EXTERNAL") {
    return `External Candidate · ${action}`;
  }
  return null;
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
  registrationType?: string;
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
    registrationType: registration.registrationType ?? null,
    visibility: registration.visibility ?? null,
    billingScope: registration.billingScope ?? null,
    reason: registration.reason ?? null,
    assessmentHubCandidateNumberSnapshot:
      registration.assessmentHubCandidateNumberSnapshot ?? null,
    candidateTypeSnapshot: registration.candidateTypeSnapshot ?? null,
  };
}

export {
  auditTypeMarker,
  buildRegistrationAuditPayload,
  formatRegistrationAuditNote,
  loadRegistrationAuditContext,
  type RegistrationAuditPayload,
} from "@/lib/registrations/audit-payload";
