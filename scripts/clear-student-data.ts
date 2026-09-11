import "dotenv/config";
import { exitAfterPrismaScript, prisma } from "../src/lib/prisma";

const DEFAULT_BOARD_CODES = ["EDEXCEL", "CIE", "AQA"] as const;

async function countStudentData() {
  const [students, candidates, workspaces, registrations, feeStatements] = await Promise.all([
    prisma.user.count({ where: { role: "STUDENT" } }),
    prisma.candidate.count(),
    prisma.registrationWorkspace.count(),
    prisma.studentExamRegistration.count(),
    prisma.feeStatement.count(),
  ]);

  return { students, candidates, workspaces, registrations, feeStatements };
}

async function clearStudentOperationalData() {
  await prisma.$transaction(async (tx) => {
    await tx.feeStatement.updateMany({
      data: {
        revisedFromStatementId: null,
        revisedToStatementId: null,
      },
    });

    await tx.reviewRequest.deleteMany();
    await tx.cashInRequest.deleteMany();
    await tx.accessToScriptRequest.deleteMany();
    await tx.certificateRequest.deleteMany();

    await tx.feeStatementItem.deleteMany();
    await tx.feeStatement.deleteMany();
    await tx.feeAuditLog.deleteMany();

    await tx.registrationChangeRequestExamSession.deleteMany();
    await tx.registrationChangeRequest.deleteMany();
    await tx.registrationAuditLog.deleteMany();
    await tx.studentExamRegistration.deleteMany();
    await tx.registrationWorkspace.deleteMany();
    await tx.registrationWindow.deleteMany();

    await tx.reviewWindowService.deleteMany();
    await tx.reviewWindow.deleteMany();
    await tx.postResultsAuditLog.deleteMany();
    await tx.examDocumentAuditLog.deleteMany();

    await tx.candidateAuditLog.deleteMany();
    await tx.candidateExamIdentity.deleteMany();
    await tx.candidate.deleteMany();

    await tx.examBoard.deleteMany({
      where: { code: { notIn: [...DEFAULT_BOARD_CODES] } },
    });
  });
}

async function main() {
  if (process.env.CLEAR_STUDENT_DATA_CONFIRM !== "yes") {
    console.error(
      "Refusing to clear student data. Set CLEAR_STUDENT_DATA_CONFIRM=yes to proceed.",
    );
    process.exit(1);
  }

  const before = await countStudentData();
  console.log("Before:", before);

  await clearStudentOperationalData();

  const deletedStudents = await prisma.user.deleteMany({
    where: { role: "STUDENT" },
  });

  const currentYear = new Date().getFullYear();
  await prisma.studentIdSequence.deleteMany({ where: { year: currentYear } });

  const after = await countStudentData();
  console.log("After:", after);
  console.log(
    `Deleted ${deletedStudents.count} student user account(s). Admin, exam officer, teachers, and exam catalog are preserved.`,
  );
  console.log("Re-import students from Admin → Users → Import.");
  await exitAfterPrismaScript(prisma, 0);
}

main().catch(async (error) => {
  console.error(error);
  await exitAfterPrismaScript(prisma, 1);
});
