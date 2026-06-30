import type { FeeAuditAction } from "@/generated/prisma/enums";
import { createFeeAuditLog } from "@/lib/fees/audit";
import { prisma } from "@/lib/prisma";

export type FeeStatementChangeReasonCode =
  | "EXAM_ADDED"
  | "EXAM_REMOVED"
  | "EXAM_REPLACED"
  | "CANDIDATE_REGISTRATION_FEE_ADDED"
  | "CANDIDATE_REGISTRATION_FEE_REMOVED"
  | "ADDITIONAL_SERVICE_ADDED"
  | "ADDITIONAL_SERVICE_REMOVED"
  | "MANUAL_BILLING_ADJUSTMENT"
  | "FEE_SCHEDULE_CHANGED";

const REASON_LABELS: Record<FeeStatementChangeReasonCode, string> = {
  EXAM_ADDED: "Exam added",
  EXAM_REMOVED: "Exam removed",
  EXAM_REPLACED: "Exam replaced",
  CANDIDATE_REGISTRATION_FEE_ADDED: "Candidate Registration Fee added",
  CANDIDATE_REGISTRATION_FEE_REMOVED: "Candidate Registration Fee removed",
  ADDITIONAL_SERVICE_ADDED: "Additional Registration Service added",
  ADDITIONAL_SERVICE_REMOVED: "Additional Registration Service removed",
  MANUAL_BILLING_ADJUSTMENT: "Manual billing adjustment by Exams Office",
  FEE_SCHEDULE_CHANGED: "Fee Schedule change affecting billing",
};

const REASON_AUDIT_ACTION: Record<FeeStatementChangeReasonCode, FeeAuditAction> = {
  EXAM_ADDED: "EXAM_ADDED",
  EXAM_REMOVED: "EXAM_REMOVED",
  EXAM_REPLACED: "EXAM_REPLACED",
  CANDIDATE_REGISTRATION_FEE_ADDED: "CANDIDATE_REGISTRATION_FEE_ADDED",
  CANDIDATE_REGISTRATION_FEE_REMOVED: "CANDIDATE_REGISTRATION_FEE_REMOVED",
  ADDITIONAL_SERVICE_ADDED: "ADDITIONAL_SERVICE_ADDED",
  ADDITIONAL_SERVICE_REMOVED: "ADDITIONAL_SERVICE_REMOVED",
  MANUAL_BILLING_ADJUSTMENT: "FEE_STATEMENT_MARKED_NEEDS_REGENERATION",
  FEE_SCHEDULE_CHANGED: "FEE_STATEMENT_MARKED_NEEDS_REGENERATION",
};

export function feeStatementChangeReasonLabel(code: FeeStatementChangeReasonCode): string {
  return REASON_LABELS[code];
}

async function deleteFeeStatement(statementId: string) {
  await prisma.feeStatementItem.deleteMany({ where: { feeStatementId: statementId } });
  await prisma.feeStatement.delete({ where: { id: statementId } });
}

/** Keep only the newest ISSUED/PAID statement per workspace; mark older ones Superseded. */
export async function repairDuplicateIssuedFeeStatements(workspaceId: string) {
  const active = await prisma.feeStatement.findMany({
    where: {
      registrationWorkspaceId: workspaceId,
      statementKind: "NORMAL",
      status: { in: ["ISSUED", "PAID"] },
    },
    orderBy: [{ issuedAt: "desc" }, { generatedAt: "desc" }],
  });

  if (active.length <= 1) return;

  const [current, ...older] = active;
  for (const old of older) {
    await prisma.feeStatement.update({
      where: { id: old.id },
      data: {
        status: "REVISED",
        revisedToStatementId: current.id,
      },
    });
  }

  await prisma.feeStatement.update({
    where: { id: current.id },
    data: { revisedFromStatementId: older[0]?.id ?? null },
  });
}

export async function markFeeStatementsNeedsRegeneration(params: {
  workspaceId: string;
  reasonCode: FeeStatementChangeReasonCode;
  performedByUserId: string;
  note?: string;
}) {
  const reason = params.note?.trim() || feeStatementChangeReasonLabel(params.reasonCode);
  const now = new Date();

  const candidates = await prisma.feeStatement.findMany({
    where: {
      registrationWorkspaceId: params.workspaceId,
      statementKind: "NORMAL",
      status: { in: ["ISSUED", "PAID", "DRAFT"] },
    },
    select: {
      id: true,
      statementNo: true,
      status: true,
      registrationWindowId: true,
      studentId: true,
      candidateId: true,
    },
  });

  if (candidates.length === 0) return [];

  await prisma.feeStatement.updateMany({
    where: {
      id: { in: candidates.map((row) => row.id) },
    },
    data: {
      status: "NEEDS_REGENERATION",
      regenerationReason: reason,
      regenerationChangedByUserId: params.performedByUserId,
      regenerationChangedAt: now,
    },
  });

  const workspace = await prisma.registrationWorkspace.findUnique({
    where: { id: params.workspaceId },
    select: {
      registrationWindow: {
        select: {
          id: true,
          examBoard: { select: { name: true, code: true } },
        },
      },
    },
  });

  await createFeeAuditLog({
    action: REASON_AUDIT_ACTION[params.reasonCode],
    performedByUserId: params.performedByUserId,
    registrationWindowId: workspace?.registrationWindow.id,
    note: reason,
    metadata: {
      workspaceId: params.workspaceId,
      reasonCode: params.reasonCode,
      statementIds: candidates.map((row) => row.id),
      statementNos: candidates.map((row) => row.statementNo),
      examBoard: workspace?.registrationWindow.examBoard,
    },
  }).catch((error) => {
    console.error("Fee audit log failed:", error);
  });

  await createFeeAuditLog({
    action: "FEE_STATEMENT_MARKED_NEEDS_REGENERATION",
    performedByUserId: params.performedByUserId,
    registrationWindowId: workspace?.registrationWindow.id,
    note: reason,
    metadata: {
      workspaceId: params.workspaceId,
      reasonCode: params.reasonCode,
      affectedStatements: candidates,
    },
  }).catch((error) => {
    console.error("Fee audit log failed:", error);
  });

  return candidates;
}

export async function finalizeRevisedFeeStatement(params: {
  workspaceId: string;
  newStatementId: string;
  performedByUserId: string;
  registrationWindowId?: string | null;
}) {
  const outdated = await prisma.feeStatement.findMany({
    where: {
      registrationWorkspaceId: params.workspaceId,
      statementKind: "NORMAL",
      id: { not: params.newStatementId },
      status: { in: ["ISSUED", "PAID", "NEEDS_REGENERATION"] },
    },
    orderBy: { generatedAt: "desc" },
  });

  if (outdated.length === 0) return null;

  const primary =
    outdated.find((row) => row.issuedAt !== null) ?? outdated[0]!;

  for (const old of outdated) {
    if (!old.issuedAt) {
      await deleteFeeStatement(old.id);
      continue;
    }

    await prisma.feeStatement.update({
      where: { id: old.id },
      data: {
        status: "REVISED",
        revisedToStatementId: params.newStatementId,
      },
    });
  }

  await prisma.feeStatement.update({
    where: { id: params.newStatementId },
    data: { revisedFromStatementId: primary.id },
  });

  await createFeeAuditLog({
    action: "FEE_STATEMENT_REGENERATED_REVISED",
    performedByUserId: params.performedByUserId,
    registrationWindowId: params.registrationWindowId,
    metadata: {
      workspaceId: params.workspaceId,
      newStatementId: params.newStatementId,
      previousStatementIds: outdated.map((row) => row.id),
      previousStatementNos: outdated.map((row) => row.statementNo),
    },
  }).catch((error) => {
    console.error("Fee audit log failed:", error);
  });

  return primary;
}

export async function loadFeeStatementVersionHistory(workspaceId: string) {
  return prisma.feeStatement.findMany({
    where: {
      registrationWorkspaceId: workspaceId,
      statementKind: "NORMAL",
    },
    include: {
      generatedBy: { select: { id: true, name: true } },
      regenerationChangedBy: { select: { id: true, name: true } },
      revisedFromStatement: { select: { id: true, statementNo: true, status: true } },
      revisedToStatement: { select: { id: true, statementNo: true, status: true } },
    },
    orderBy: [{ generatedAt: "asc" }],
  });
}
