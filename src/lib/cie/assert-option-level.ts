import { isCieExamBoard } from "@/lib/exam-boards/branch";
import { RegistrationError } from "@/lib/registrations/errors";
import { prisma } from "@/lib/prisma";

/** CIE open-period / late flows must use whole syllabus options, not single papers. */
export async function assertNotCiePaperLevelChange(registrationWindowId: string) {
  const window = await prisma.registrationWindow.findUnique({
    where: { id: registrationWindowId },
    include: { examBoard: { select: { code: true, name: true } } },
  });
  if (!window) {
    throw new RegistrationError("Registration window not found", 404);
  }
  if (isCieExamBoard(window.examBoard.code, window.examBoard.name)) {
    throw new RegistrationError(
      "Cambridge changes must add, withdraw, or replace a complete syllabus option (not a single paper). Use CIE option registration, or ask the Exams Office for an option-level adjustment.",
      400,
    );
  }
}
