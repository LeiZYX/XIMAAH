import type { FeeStatementKind, RegistrationType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

const ACTIVE_STATEMENT_STATUSES = ["DRAFT", "ISSUED", "PAID", "NEEDS_REGENERATION"] as const;

export async function findLockedWorkspacesForBilling(
  registrationWindowId: string,
  registrationType: RegistrationType,
) {
  return prisma.registrationWorkspace.findMany({
    where: {
      registrationWindowId,
      registrationType,
      OR: [
        { lockedAt: { not: null } },
        {
          registrations: {
            some: { status: "LOCKED" },
          },
        },
      ],
    },
  });
}

export async function hasActiveFeeStatement(
  workspaceId: string,
  statementKind: FeeStatementKind = "NORMAL",
): Promise<boolean> {
  const row = await prisma.feeStatement.findFirst({
    where: {
      registrationWorkspaceId: workspaceId,
      statementKind,
      status: { in: [...ACTIVE_STATEMENT_STATUSES] },
    },
    select: { id: true },
  });
  return Boolean(row);
}

export async function shouldRegenerateFeeStatement(
  workspaceId: string,
  statementKind: FeeStatementKind = "NORMAL",
): Promise<boolean> {
  const needsRegeneration = await prisma.feeStatement.findFirst({
    where: {
      registrationWorkspaceId: workspaceId,
      statementKind,
      status: "NEEDS_REGENERATION",
    },
    select: { id: true },
  });
  if (needsRegeneration) return true;

  if (await hasActiveFeeStatement(workspaceId, statementKind)) {
    return false;
  }
  const superseded = await prisma.feeStatement.findFirst({
    where: {
      registrationWorkspaceId: workspaceId,
      statementKind,
      status: "REVISED",
    },
    select: { id: true },
  });
  return Boolean(superseded);
}

export function activeFeeStatementStatuses() {
  return [...ACTIVE_STATEMENT_STATUSES];
}
