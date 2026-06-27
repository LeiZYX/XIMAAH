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
};

export function serializeAuditValue(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  return JSON.stringify(value);
}

export async function createRegistrationAuditLog(
  params: {
    registrationWorkspaceId?: string | null;
    studentId: string;
    registrationId?: string | null;
    examSessionId: string;
    action: RegistrationAuditAction;
    performedById: string;
    performedByRole?: string | null;
    beforeValue?: unknown;
    afterValue?: unknown;
    reason?: string;
    note?: string;
  },
  client: AuditClient = prisma,
) {
  const workspaceReady = await hasWorkspaceSchema();
  const action = workspaceReady
    ? params.action
    : (LEGACY_AUDIT_ACTION[params.action] ?? params.action);

  const data: Record<string, unknown> = {
    studentId: params.studentId,
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
    data.performedByRole = params.performedByRole ?? null;
    data.reason = params.reason ?? null;
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
  };
}
