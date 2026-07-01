import "dotenv/config";
import { ensureDefaultExamBoards } from "../prisma/seed-exam-boards";
import { backfillCandidatesFromStudents } from "../src/lib/candidates/service";
import { exitAfterPrismaScript, prisma } from "../src/lib/prisma";

const DEFAULT_BOARD_CODES = ["EDEXCEL", "CIE", "AQA"] as const;

async function countOperationalData() {
  const [
    users,
    examBoards,
    registrationWindows,
    workspaces,
    registrations,
    feeStatements,
    feeStatementItems,
    candidates,
    reviewWindows,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.examBoard.count(),
    prisma.registrationWindow.count(),
    prisma.registrationWorkspace.count(),
    prisma.studentExamRegistration.count(),
    prisma.feeStatement.count(),
    prisma.feeStatementItem.count(),
    prisma.candidate.count(),
    prisma.reviewWindow.count(),
  ]);

  return {
    users,
    examBoards,
    registrationWindows,
    workspaces,
    registrations,
    feeStatements,
    feeStatementItems,
    candidates,
    reviewWindows,
  };
}

async function clearRegistrationAndFeeData() {
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
  if (process.env.CLEAN_REGISTRATION_DATA_CONFIRM !== "yes") {
    console.error(
      "Refusing to clean registration data. Set CLEAN_REGISTRATION_DATA_CONFIRM=yes to proceed.",
    );
    process.exit(1);
  }

  const before = await countOperationalData();
  console.log("Before:", before);

  await clearRegistrationAndFeeData();

  const boards = await ensureDefaultExamBoards(prisma);
  console.log(
    "Exam boards kept:",
    [boards.edexcel.code, boards.cie.code, boards.aqa.code].join(", "),
  );

  const candidateBackfill = await backfillCandidatesFromStudents();
  console.log(
    `Candidates backfilled for test students: ${candidateBackfill.created} created, ${candidateBackfill.processed} processed.`,
  );

  const after = await countOperationalData();
  console.log("After:", after);
  console.log("Cleanup complete. Test users and default exam boards are preserved.");
  await exitAfterPrismaScript(prisma, 0);
}

main().catch(async (error) => {
  console.error(error);
  await exitAfterPrismaScript(prisma, 1);
});
