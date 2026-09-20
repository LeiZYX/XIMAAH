import { prisma } from "@/lib/prisma";
import { sumWorkspacePaidGbp } from "@/lib/fees/payment-due";

/** True when the workspace has already taken money (online PAID or mark-paid offline). */
export async function workspaceHasCashCollected(workspaceId: string): Promise<boolean> {
  const onlinePaid = await sumWorkspacePaidGbp(workspaceId);
  if (onlinePaid > 0.004) return true;

  const offlinePaid = await prisma.feeStatement.count({
    where: {
      registrationWorkspaceId: workspaceId,
      paymentSettlement: "OFFLINE",
    },
  });
  return offlinePaid > 0;
}
