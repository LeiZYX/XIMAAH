import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env") });

async function main() {
  const { prisma } = await import("../src/lib/prisma");

  const before = {
    registrations: await prisma.studentExamRegistration.count(),
    workspaces: await prisma.registrationWorkspace.count(),
    auditLogs: await prisma.registrationAuditLog.count(),
    changeRequests: await prisma.registrationChangeRequest.count(),
    feeStatements: await prisma.feeStatement.count(),
  };
  console.log("Before:", before);

  await prisma.$transaction(async (tx) => {
    await tx.registrationChangeRequestExamSession.deleteMany();
    await tx.registrationChangeRequest.deleteMany();
    await tx.feeStatementItem.deleteMany();
    await tx.feeStatement.deleteMany();
    await tx.registrationAuditLog.deleteMany();
    await tx.studentExamRegistration.deleteMany();
    await tx.registrationWorkspace.deleteMany();
  });

  const after = {
    registrations: await prisma.studentExamRegistration.count(),
    workspaces: await prisma.registrationWorkspace.count(),
    auditLogs: await prisma.registrationAuditLog.count(),
    changeRequests: await prisma.registrationChangeRequest.count(),
    feeStatements: await prisma.feeStatement.count(),
  };
  console.log("After:", after);

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
