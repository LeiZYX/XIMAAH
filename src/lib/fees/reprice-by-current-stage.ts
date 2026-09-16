import type { FeeEntryType, FeeStatementDisplayCurrency } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { createFeeAuditLog } from "@/lib/fees/audit";
import { DEFAULT_FEE_STATEMENT_DISPLAY_CURRENCY } from "@/lib/fees/display-currency";
import { FeeError, regenerateRevisedFeeStatement } from "@/lib/fees/statement";
import {
  feeStageLabel,
  resolveEntryTypeForRegistration,
  type RegistrationFeeStageRecord,
} from "@/lib/registrations/fee-stages";

export type EntryTypeChange = {
  registrationId: string;
  paperCode: string | null;
  from: FeeEntryType;
  to: FeeEntryType;
};

export async function repriceWorkspaceByCurrentFeeStage(params: {
  workspaceId: string;
  performedByUserId: string;
  displayCurrency?: FeeStatementDisplayCurrency;
  now?: Date;
}) {
  const now = params.now ?? new Date();
  const displayCurrency =
    params.displayCurrency ?? DEFAULT_FEE_STATEMENT_DISPLAY_CURRENCY;

  const workspace = await prisma.registrationWorkspace.findUnique({
    where: { id: params.workspaceId },
    include: {
      registrationWindow: {
        include: {
          feeStages: { orderBy: { sequence: "asc" } },
        },
      },
      registrations: {
        where: {
          status: { in: ["ACTIVE", "LOCKED"] },
          registrationType: "INTERNAL_NORMAL",
          billingScope: { in: ["NORMAL_BILLING", "MANUAL_REVIEW"] },
        },
        include: {
          paper: { select: { code: true } },
        },
      },
    },
  });

  if (!workspace) {
    throw new FeeError("Registration workspace not found");
  }

  if (workspace.registrationType !== "INTERNAL_NORMAL") {
    throw new FeeError(
      "Reprice by current fee stage only applies to normal internal registrations",
    );
  }

  const feeStages = workspace.registrationWindow.feeStages as RegistrationFeeStageRecord[];
  const resolution = resolveEntryTypeForRegistration({ feeStages, now });

  if (!feeStages.some((stage) => stage.enabled)) {
    throw new FeeError(
      "No fee stages are enabled on this registration window. Configure Normal / Late / High Late first.",
    );
  }

  if (!resolution.feeStageId && !resolution.defaultedToNormal) {
    throw new FeeError("Could not resolve an active fee stage for the current time.");
  }

  const targetEntryType = resolution.entryType;
  const changes: EntryTypeChange[] = [];
  const skippedOverridden: Array<{ registrationId: string; paperCode: string | null; entryType: FeeEntryType }> =
    [];

  await prisma.$transaction(async (tx) => {
    for (const reg of workspace.registrations) {
      if (reg.entryTypeOverridden) {
        skippedOverridden.push({
          registrationId: reg.id,
          paperCode: reg.paper?.code ?? null,
          entryType: reg.entryType,
        });
        continue;
      }
      if (reg.entryType === targetEntryType && reg.feeStageId === resolution.feeStageId) {
        continue;
      }
      changes.push({
        registrationId: reg.id,
        paperCode: reg.paper?.code ?? null,
        from: reg.entryType,
        to: targetEntryType,
      });
      await tx.studentExamRegistration.update({
        where: { id: reg.id },
        data: {
          entryType: targetEntryType,
          feeStageId: resolution.feeStageId,
          entryTypeOverridden: false,
          entryTypeOverrideReason: null,
        },
      });
    }

    if (!workspace.entryTypeOverridden) {
      await tx.registrationWorkspace.update({
        where: { id: workspace.id },
        data: {
          entryType: targetEntryType,
          feeStageId: resolution.feeStageId,
          isLateRegistration: resolution.isLateRegistration,
          entryTypeOverridden: false,
          entryTypeOverrideReason: null,
        },
      });
    }
  });

  const statement = await regenerateRevisedFeeStatement({
    workspaceId: params.workspaceId,
    generatedByUserId: params.performedByUserId,
    displayCurrency,
  });

  await createFeeAuditLog({
    action: "FEE_STATEMENT_REPRICED_BY_CURRENT_STAGE",
    performedByUserId: params.performedByUserId,
    registrationWindowId: workspace.registrationWindowId,
    note: `Repriced to ${feeStageLabel(targetEntryType)} using current fee-stage windows`,
    metadata: {
      workspaceId: workspace.id,
      statementId: statement.id,
      statementNo: statement.statementNo,
      targetEntryType,
      feeStageId: resolution.feeStageId,
      defaultedToNormal: resolution.defaultedToNormal,
      changes,
      skippedOverridden,
      asOf: now.toISOString(),
    },
  }).catch((auditError) => {
    console.error("Fee audit log failed:", auditError);
  });

  return {
    statement,
    targetEntryType,
    targetStageLabel: feeStageLabel(targetEntryType),
    defaultedToNormal: resolution.defaultedToNormal,
    changes,
    skippedOverridden,
  };
}
