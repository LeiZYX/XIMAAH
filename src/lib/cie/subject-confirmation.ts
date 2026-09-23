import { RegistrationStatus } from "@/generated/prisma/enums";
import type { UserRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { RegistrationError } from "@/lib/registrations/errors";

export async function listPendingCieConfirmationsForTeacher(teacherId: string) {
  const assignments = await prisma.teacherAssignment.findMany({
    where: { teacherId },
    select: { subjectId: true },
  });
  const subjectIds = assignments.map((row) => row.subjectId);
  if (subjectIds.length === 0) return [];

  return prisma.cieEntryAssignment.findMany({
    where: {
      status: RegistrationStatus.PENDING_SUBJECT_TEACHER,
      subjectId: { in: subjectIds },
    },
    include: {
      subject: { select: { id: true, name: true, code: true } },
      candidate: {
        select: {
          id: true,
          englishName: true,
          studentNumber: true,
          grade: true,
          className: true,
        },
      },
      registrationWindow: {
        select: {
          id: true,
          title: true,
          academicYear: true,
          requireSubjectTeacherConfirmation: true,
          examBoard: { select: { code: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function confirmCieAssignment(params: {
  assignmentId: string;
  actorUserId: string;
  actorRole: UserRole;
  approve: boolean;
  reason?: string;
}) {
  const assignment = await prisma.cieEntryAssignment.findUnique({
    where: { id: params.assignmentId },
    include: {
      registrationWindow: {
        include: { examBoard: { select: { code: true, name: true } } },
      },
    },
  });
  if (!assignment) {
    throw new RegistrationError("CIE assignment not found", 404);
  }
  if (assignment.status !== RegistrationStatus.PENDING_SUBJECT_TEACHER) {
    throw new RegistrationError("Assignment is not awaiting subject-teacher confirmation", 400);
  }

  const isStaff = params.actorRole === "ADMIN" || params.actorRole === "EXAM_OFFICER";
  if (!isStaff) {
    if (params.actorRole !== "SUBJECT_TEACHER") {
      throw new RegistrationError("Forbidden", 403);
    }
    const teacherOk = await prisma.teacherAssignment.findFirst({
      where: { teacherId: params.actorUserId, subjectId: assignment.subjectId },
    });
    if (!teacherOk) {
      throw new RegistrationError("You are not assigned to this subject", 403);
    }
  }

  const now = new Date();

  if (!params.approve) {
    const reason = params.reason?.trim();
    if (!reason) {
      throw new RegistrationError("Rejection reason is required", 400);
    }
    return prisma.$transaction(async (tx) => {
      await tx.studentExamRegistration.updateMany({
        where: {
          candidateId: assignment.candidateId,
          registrationWindowId: assignment.registrationWindowId,
          subjectId: assignment.subjectId,
          status: RegistrationStatus.PENDING_SUBJECT_TEACHER,
        },
        data: {
          status: RegistrationStatus.CANCELLED,
          cancelledAt: now,
        },
      });
      await tx.cieEntryAssignment.update({
        where: { id: assignment.id },
        data: {
          status: RegistrationStatus.CANCELLED,
          rejectedReason: reason,
          confirmedByUserId: params.actorUserId,
          confirmedAt: now,
        },
      });
      return { ok: true as const, approved: false };
    });
  }

  return prisma.$transaction(async (tx) => {
    await tx.studentExamRegistration.updateMany({
      where: {
        candidateId: assignment.candidateId,
        registrationWindowId: assignment.registrationWindowId,
        subjectId: assignment.subjectId,
        status: RegistrationStatus.PENDING_SUBJECT_TEACHER,
      },
      data: { status: RegistrationStatus.ACTIVE },
    });
    await tx.cieEntryAssignment.update({
      where: { id: assignment.id },
      data: {
        status: RegistrationStatus.ACTIVE,
        confirmedByUserId: params.actorUserId,
        confirmedAt: now,
        rejectedReason: null,
      },
    });
    return { ok: true as const, approved: true };
  });
}
