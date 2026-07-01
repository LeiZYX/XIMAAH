import "dotenv/config";
import { exitAfterPrismaScript, prisma } from "../src/lib/prisma";

async function countRegistrationData() {
  const [
    registrations,
    workspaces,
    feeStatements,
    auditLogs,
    changeRequests,
  ] = await Promise.all([
    prisma.studentExamRegistration.count(),
    prisma.registrationWorkspace.count(),
    prisma.feeStatement.count({ where: { registrationWorkspaceId: { not: null } } }),
    prisma.registrationAuditLog.count(),
    prisma.registrationChangeRequest.count(),
  ]);

  return { registrations, workspaces, feeStatements, auditLogs, changeRequests };
}

async function clearAllRegistrationData() {
  await prisma.$transaction(async (tx) => {
    await tx.feeStatement.updateMany({
      data: {
        revisedFromStatementId: null,
        revisedToStatementId: null,
      },
    });

    await tx.feeStatementItem.deleteMany({
      where: {
        feeStatement: { registrationWorkspaceId: { not: null } },
      },
    });

    await tx.reviewRequest.deleteMany({
      where: {
        OR: [
          { registrationItemId: { not: null } },
          { feeStatement: { registrationWorkspaceId: { not: null } } },
        ],
      },
    });

    await tx.cashInRequest.deleteMany({
      where: {
        feeStatement: { registrationWorkspaceId: { not: null } },
      },
    });

    await tx.accessToScriptRequest.deleteMany({
      where: { registrationItemId: { not: null } },
    });

    await tx.certificateRequest.deleteMany({
      where: { feeStatement: { registrationWorkspaceId: { not: null } } },
    });

    await tx.feeStatement.deleteMany({
      where: { registrationWorkspaceId: { not: null } },
    });

    await tx.registrationChangeRequestExamSession.deleteMany();
    await tx.registrationChangeRequest.deleteMany();
    await tx.registrationAuditLog.deleteMany();
    await tx.studentExamRegistration.deleteMany();
    await tx.registrationWorkspace.deleteMany();
  });
}

async function main() {
  if (process.env.CLEAR_REGISTRATIONS_CONFIRM !== "yes") {
    console.error(
      "Refusing to clear registration data. Set CLEAR_REGISTRATIONS_CONFIRM=yes to proceed.",
    );
    process.exit(1);
  }

  const before = await countRegistrationData();
  console.log("Before:", before);

  if (before.registrations === 0 && before.workspaces === 0) {
    console.log("No registration records to clear.");
    await exitAfterPrismaScript(prisma, 0);
    return;
  }

  await clearAllRegistrationData();

  const after = await countRegistrationData();
  console.log("After:", after);
  console.log("All registration records cleared.");
  await exitAfterPrismaScript(prisma, 0);
}

main().catch(async (error) => {
  console.error(error);
  await exitAfterPrismaScript(prisma, 1);
});
