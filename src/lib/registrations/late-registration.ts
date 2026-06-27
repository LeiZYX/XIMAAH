import type { UserRole } from "@/generated/prisma/enums";
import {
  RegistrationAuditAction,
  RegistrationStatus,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { appendAdjustmentHistoryBatch } from "@/lib/registrations/adjustment-history";
import {
  createRegistrationAuditLog,
  registrationAuditSnapshot,
} from "@/lib/registrations/audit";
import { RegistrationError } from "@/lib/registrations/errors";
import { registrationInclude } from "@/lib/registrations/include";
import { ensureRegistrationWorkspace, getRegistrationWorkspaceById } from "@/lib/registrations/workspace";

export interface LateRegistrationInput {
  studentId: string;
  registrationWindowId: string;
  examSessionIds: string[];
  reason: string;
  teacherRequestedBy?: { name: string; role: UserRole };
}

function lateRegistrationAuditAction(role: UserRole): RegistrationAuditAction {
  return role === "EXAM_OFFICER"
    ? RegistrationAuditAction.EO_LATE_REGISTRATION_CREATED
    : RegistrationAuditAction.ADMIN_LATE_REGISTRATION_CREATED;
}

function examLine(session: {
  paper: { code: string; title: string; subject: { name: string } };
}) {
  return {
    subject: session.paper.subject.name,
    paperCode: session.paper.code,
    paperTitle: session.paper.title,
  };
}

export async function assertLateRegistrationAllowed(
  registrationWindowId: string,
  examSessionIds: string[],
) {
  if (examSessionIds.length === 0) {
    throw new RegistrationError("At least one exam session must be selected", 400);
  }

  const window = await prisma.registrationWindow.findUnique({
    where: { id: registrationWindowId },
    include: { examBoard: true, examSeries: true },
  });
  if (!window) {
    throw new RegistrationError("Registration window not found", 404);
  }
  if (window.status !== "CLOSED") {
    throw new RegistrationError("Late registration is only allowed for closed registration windows", 400);
  }

  const sessions = await prisma.examSession.findMany({
    where: { id: { in: examSessionIds } },
    include: {
      paper: { include: { subject: { include: { qualification: true } } } },
      examSeries: true,
    },
  });

  if (sessions.length !== examSessionIds.length) {
    throw new RegistrationError("One or more exam sessions were not found", 404);
  }

  for (const session of sessions) {
    if (session.examSeriesId !== window.examSeriesId) {
      throw new RegistrationError(
        `Exam session ${session.paper.code} does not belong to the selected registration window series`,
        400,
      );
    }
  }

  return { window, sessions };
}

export async function assertNoDuplicateStudentExamSessions(
  studentId: string,
  examSessionIds: string[],
) {
  const existing = await prisma.studentExamRegistration.findMany({
    where: {
      studentId,
      examSessionId: { in: examSessionIds },
      status: { in: [RegistrationStatus.ACTIVE, RegistrationStatus.LOCKED] },
    },
    include: { paper: true },
  });

  if (existing.length > 0) {
    const codes = existing.map((row) => row.paper.code).join(", ");
    throw new RegistrationError(
      `Student is already registered for: ${codes}`,
      409,
    );
  }
}

export async function applyLateRegistration(
  performedBy: { id: string; role: UserRole },
  input: LateRegistrationInput,
) {
  if (!["ADMIN", "EXAM_OFFICER"].includes(performedBy.role)) {
    throw new RegistrationError("Only Admin or Exam Officer can create late registrations", 403);
  }

  const reason = input.reason?.trim();
  if (!reason) {
    throw new RegistrationError("Reason for late registration is required", 400);
  }

  const uniqueSessionIds = [...new Set(input.examSessionIds)];
  const { window, sessions } = await assertLateRegistrationAllowed(
    input.registrationWindowId,
    uniqueSessionIds,
  );

  await assertNoDuplicateStudentExamSessions(input.studentId, uniqueSessionIds);

  const student = await prisma.user.findUnique({
    where: { id: input.studentId },
    include: { studentProfile: true },
  });
  if (!student?.studentProfile) {
    throw new RegistrationError("Student profile not found", 404);
  }

  const workspace = await ensureRegistrationWorkspace(
    input.studentId,
    input.registrationWindowId,
  );

  const now = new Date();
  const summary = { added: [] as ReturnType<typeof examLine>[], removed: [], replaced: [] };

  await prisma.$transaction(async (tx) => {
    for (const session of sessions) {
      const row = await tx.studentExamRegistration.create({
        data: {
          studentId: input.studentId,
          registrationWorkspaceId: workspace.id,
          examSessionId: session.id,
          registrationWindowId: window.id,
          examBoardId: window.examBoardId,
          examSeriesId: window.examSeriesId,
          subjectId: session.paper.subjectId,
          paperId: session.paper.id,
          studentNameSnapshot: student.name,
          studentNoSnapshot: student.studentProfile!.studentNo,
          gradeSnapshot: student.studentProfile!.currentGrade,
          classNameSnapshot: student.studentProfile!.currentClassName,
          emailSnapshot: student.studentProfile!.email ?? student.email,
          phoneSnapshot: student.studentProfile!.phone ?? student.phone,
          status: RegistrationStatus.LOCKED,
          lockedAt: now,
        },
        include: registrationInclude,
      });

      summary.added.push(examLine(row.examSession));

      await createRegistrationAuditLog(
        {
          registrationWorkspaceId: workspace.id,
          studentId: input.studentId,
          registrationId: row.id,
          examSessionId: session.id,
          action: lateRegistrationAuditAction(performedBy.role),
          performedById: performedBy.id,
          performedByRole: performedBy.role,
          reason,
          afterValue: registrationAuditSnapshot(row),
          note: "Late registration after deadline",
        },
        tx,
      );
    }

    const performer = await tx.user.findUnique({
      where: { id: performedBy.id },
      select: { name: true },
    });

    const existingWorkspace = await tx.registrationWorkspace.findUnique({
      where: { id: workspace.id },
      select: {
        lastAdjustmentSummary: true,
        lastAdjustedAt: true,
        lastAdjustedByRole: true,
        lastAdjustmentReason: true,
        lastAdjustedByUser: { select: { name: true } },
      },
    });

    await tx.registrationWorkspace.update({
      where: { id: workspace.id },
      data: {
        lockedAt: now,
        isLateRegistration: true,
        hasPostLockAdjustment: true,
        lastAdjustedByUserId: performedBy.id,
        lastAdjustedByRole: performedBy.role,
        lastAdjustedAt: now,
        lastAdjustmentReason: reason,
        lastAdjustmentSummary: appendAdjustmentHistoryBatch(
          existingWorkspace?.lastAdjustmentSummary ?? null,
          {
            adjustedAt: now.toISOString(),
            adjustedByName: performer?.name ?? "",
            adjustedByRole: performedBy.role,
            reason,
            requestedByName: input.teacherRequestedBy?.name,
            requestedByRole: input.teacherRequestedBy?.role,
            isLateRegistration: true,
            ...summary,
          },
          {
            lastAdjustedAt: existingWorkspace?.lastAdjustedAt,
            lastAdjustedByName: existingWorkspace?.lastAdjustedByUser?.name,
            lastAdjustedByRole: existingWorkspace?.lastAdjustedByRole,
            lastAdjustmentReason: existingWorkspace?.lastAdjustmentReason,
          },
        ),
      },
    });
  });

  return getRegistrationWorkspaceById(workspace.id);
}
