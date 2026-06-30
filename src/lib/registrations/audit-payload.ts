import type { Prisma } from "@/generated/prisma/client";
import type {
  RegistrationAuditAction,
  RegistrationType,
  UserRole,
} from "@/generated/prisma/enums";
import { RegistrationError } from "@/lib/registrations/errors";
import { registrationTypeLabel } from "@/lib/registrations/registration-type";

type AuditClient = Prisma.TransactionClient | {
  registrationWorkspace: Prisma.RegistrationWorkspaceDelegate;
};

export interface RegistrationAuditPayload {
  registrationType: RegistrationType | string | null;
  registrationNumber: string | null;
  feeStatementNumber: string | null;
  issueNumber: string | null;
  candidateId: string | null;
  candidateType: string | null;
  visibility: string | null;
  billingScope: string | null;
  registrationSource: string | null;
  performedByUserId: string;
  performedByRole: string | null;
  reason: string | null;
  performedAt: string;
}

const REASON_REQUIRED_TYPES = new Set<RegistrationType>(["RESTRICTED_INTERNAL", "EXTERNAL"]);

const REASON_REQUIRED_ACTIONS = new Set<RegistrationAuditAction | string>([
  "ADD",
  "REMOVE",
  "REPLACE",
  "RESTRICTED_INTERNAL_REGISTRATION_CREATED",
  "RESTRICTED_INTERNAL_REGISTRATION_UPDATED",
  "EXTERNAL_REGISTRATION_CREATED",
  "EXTERNAL_REGISTRATION_UPDATED",
  "EXTERNAL_CANDIDATE_REGISTRATION_CREATED",
  "EO_RESTRICTED_REGISTRATION_CREATED",
  "ADMIN_RESTRICTED_REGISTRATION_CREATED",
  "EO_ADD_AFTER_LOCK",
  "EO_REMOVE_AFTER_LOCK",
  "EO_REPLACE_AFTER_LOCK",
  "ADMIN_ADD_AFTER_LOCK",
  "ADMIN_REMOVE_AFTER_LOCK",
  "ADMIN_REPLACE_AFTER_LOCK",
  "CANDIDATE_REGISTRATION_FEE_ADDED",
  "CANDIDATE_REGISTRATION_FEE_REMOVED",
]);

export function auditTypeMarker(registrationType: RegistrationType | string | null | undefined): string {
  switch (registrationType) {
    case "RESTRICTED_INTERNAL":
      return "Restricted Internal";
    case "EXTERNAL":
      return "External Candidate";
    default:
      return "";
  }
}

export function formatRegistrationAuditNote(
  registrationType: RegistrationType | string | null | undefined,
  detail: string,
): string {
  const marker = auditTypeMarker(registrationType);
  if (!marker) return detail;
  return `${marker} · ${detail}`;
}

export function sessionAuditActionForType(
  registrationType: RegistrationType,
  isCreate: boolean,
): RegistrationAuditAction {
  if (isCreate) return "ADD";
  switch (registrationType) {
    case "RESTRICTED_INTERNAL":
      return "RESTRICTED_INTERNAL_REGISTRATION_UPDATED";
    case "EXTERNAL":
      return "EXTERNAL_REGISTRATION_UPDATED";
    default:
      return "ADD";
  }
}

export function workspaceCreateAuditActionForType(
  registrationType: RegistrationType,
): RegistrationAuditAction {
  switch (registrationType) {
    case "RESTRICTED_INTERNAL":
      return "RESTRICTED_INTERNAL_REGISTRATION_CREATED";
    case "EXTERNAL":
      return "EXTERNAL_REGISTRATION_CREATED";
    default:
      return "INTERNAL_NORMAL_REGISTRATION_CREATED";
  }
}

export function assertRegistrationAuditReason(
  registrationType: RegistrationType | string | null | undefined,
  action: RegistrationAuditAction | string,
  reason: string | null | undefined,
) {
  if (!registrationType || !REASON_REQUIRED_TYPES.has(registrationType as RegistrationType)) {
    return;
  }
  if (!REASON_REQUIRED_ACTIONS.has(action)) {
    return;
  }
  if (!reason?.trim()) {
    throw new RegistrationError(
      `Reason is required for ${registrationTypeLabel(registrationType)} registration changes`,
      400,
    );
  }
}

export async function loadRegistrationAuditContext(
  workspaceId: string,
  client: AuditClient,
): Promise<{
  registrationType: RegistrationType;
  registrationNumber: string | null;
  issueNumber: string | null;
  feeStatementNumber: string | null;
  candidateId: string | null;
  candidateType: string | null;
  registrationSource: string | null;
  visibility: string | null;
  billingScope: string | null;
}> {
  const workspace = await client.registrationWorkspace.findUnique({
    where: { id: workspaceId },
    select: {
      registrationType: true,
      registrationNumber: true,
      confirmationNumber: true,
      registrationSource: true,
      visibility: true,
      billingScope: true,
      candidateId: true,
      candidate: { select: { candidateType: true } },
      feeStatements: {
        orderBy: [{ issuedAt: "desc" }, { generatedAt: "desc" }],
        take: 1,
        select: { statementNo: true },
      },
    },
  });

  if (!workspace) {
    return {
      registrationType: "INTERNAL_NORMAL",
      registrationNumber: null,
      issueNumber: null,
      feeStatementNumber: null,
      candidateId: null,
      candidateType: null,
      registrationSource: null,
      visibility: null,
      billingScope: null,
    };
  }

  return {
    registrationType: workspace.registrationType,
    registrationNumber: workspace.registrationNumber,
    issueNumber: workspace.confirmationNumber,
    feeStatementNumber: workspace.feeStatements[0]?.statementNo ?? null,
    candidateId: workspace.candidateId,
    candidateType: workspace.candidate?.candidateType ?? null,
    registrationSource: workspace.registrationSource,
    visibility: workspace.visibility,
    billingScope: workspace.billingScope,
  };
}

export function buildRegistrationAuditPayload(input: {
  registrationType?: RegistrationType | string | null;
  registrationNumber?: string | null;
  feeStatementNumber?: string | null;
  issueNumber?: string | null;
  candidateId?: string | null;
  candidateType?: string | null;
  visibility?: string | null;
  billingScope?: string | null;
  registrationSource?: string | null;
  performedByUserId: string;
  performedByRole?: string | null;
  reason?: string | null;
  performedAt?: Date | string;
}): RegistrationAuditPayload {
  const performedAt =
    input.performedAt instanceof Date
      ? input.performedAt.toISOString()
      : input.performedAt ?? new Date().toISOString();

  return {
    registrationType: input.registrationType ?? null,
    registrationNumber: input.registrationNumber ?? null,
    feeStatementNumber: input.feeStatementNumber ?? null,
    issueNumber: input.issueNumber ?? null,
    candidateId: input.candidateId ?? null,
    candidateType: input.candidateType ?? null,
    visibility: input.visibility ?? null,
    billingScope: input.billingScope ?? null,
    registrationSource: input.registrationSource ?? null,
    performedByUserId: input.performedByUserId,
    performedByRole: input.performedByRole ?? null,
    reason: input.reason ?? null,
    performedAt,
  };
}

export function wrapAuditDetail(
  payload: RegistrationAuditPayload,
  detail: unknown,
): Record<string, unknown> {
  if (detail === undefined || detail === null) {
    return { payload };
  }
  if (typeof detail === "object" && detail !== null && "payload" in detail) {
    return detail as Record<string, unknown>;
  }
  return { payload, detail };
}
