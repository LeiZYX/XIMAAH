import {
  RegistrationAuditAction,
  RegistrationChangeRequestStatus,
  RegistrationChangeRequestType,
  RegistrationStatus,
  UserRole,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { applyPostLockAdjustment } from "@/lib/registrations/adjustment";
import { createRegistrationAuditLog } from "@/lib/registrations/audit";
import { RegistrationError } from "@/lib/registrations/errors";
import { canTeacherSubmitChangeRequest, isStudentRegistrationPeriodClosed } from "@/lib/registrations/window";
import {
  applyStaffStudentRegistrationAfterStudentClose,
  assertLateRegistrationAllowed,
  assertNoDuplicateStudentExamSessions,
} from "@/lib/registrations/late-registration";
import { assertStudentCanRegister } from "@/lib/students/archive";

export const changeRequestInclude = {
  requestedBy: { select: { id: true, name: true, role: true } },
  reviewedBy: { select: { id: true, name: true, role: true } },
  student: { include: { studentProfile: true } },
  registrationWorkspace: {
    include: {
      student: { include: { studentProfile: true } },
      registrationWindow: { include: { examBoard: true, examSeries: true } },
    },
  },
  registrationWindow: { include: { examBoard: true, examSeries: true } },
  targetExamSession: {
    include: { paper: { include: { subject: true } } },
  },
  replacementExamSession: {
    include: { paper: { include: { subject: true } } },
  },
  examSessions: {
    include: {
      examSession: {
        include: { paper: { include: { subject: true } } },
      },
    },
  },
} as const;

async function assertTeacherAssignedToExamSessions(teacherId: string, examSessionIds: string[]) {
  const [assignments, sessions] = await Promise.all([
    prisma.teacherAssignment.findMany({
      where: { teacherId },
      include: { subject: { select: { name: true } } },
    }),
    prisma.examSession.findMany({
      where: { id: { in: examSessionIds } },
      include: { paper: { include: { subject: { select: { name: true } } } } },
    }),
  ]);

  const assignedSubjects = new Set(
    assignments.map((assignment) => assignment.subject.name.toLowerCase()),
  );
  if (assignedSubjects.size === 0) {
    throw new RegistrationError("You are not assigned to any subjects", 403);
  }

  for (const session of sessions) {
    if (!assignedSubjects.has(session.paper.subject.name.toLowerCase())) {
      throw new RegistrationError(
        `You can only request late registration for your assigned subjects (${session.paper.subject.name} is not assigned to you)`,
        403,
      );
    }
  }
}

async function assertNoDuplicatePendingLateRequest(input: {
  studentId: string;
  registrationWindowId: string;
  examSessionIds: string[];
}) {
  const pending = await prisma.registrationChangeRequest.findMany({
    where: {
      studentId: input.studentId,
      registrationWindowId: input.registrationWindowId,
      requestType: RegistrationChangeRequestType.LATE_REGISTRATION,
      status: RegistrationChangeRequestStatus.PENDING,
    },
    include: {
      examSessions: { select: { examSessionId: true } },
    },
  });

  const pendingSessionIds = new Set(
    pending.flatMap((request) => request.examSessions.map((row) => row.examSessionId)),
  );
  const overlap = input.examSessionIds.filter((id) => pendingSessionIds.has(id));
  if (overlap.length > 0) {
    throw new RegistrationError(
      "A pending late registration request already exists for one or more of these exam sessions",
      409,
    );
  }
}

async function assertTeacherCanRequestChange(teacherId: string, registrationWorkspaceId: string) {
  const [assignments, workspace] = await Promise.all([
    prisma.teacherAssignment.findMany({
      where: { teacherId },
      include: { subject: { select: { name: true } } },
    }),
    prisma.registrationWorkspace.findUnique({
      where: { id: registrationWorkspaceId },
      include: {
        registrationWindow: true,
        registrations: {
          where: { status: { in: [RegistrationStatus.ACTIVE, RegistrationStatus.LOCKED] } },
          include: { subject: { select: { name: true } } },
        },
      },
    }),
  ]);

  if (!workspace) {
    throw new RegistrationError("Registration workspace not found", 404);
  }

  if (!canTeacherSubmitChangeRequest(workspace.registrationWindow)) {
    throw new RegistrationError("Registration window is closed for teacher change requests", 400);
  }

  const isLocked =
    Boolean(workspace.lockedAt) ||
    workspace.registrations.some((registration) => registration.status === RegistrationStatus.LOCKED) ||
    isStudentRegistrationPeriodClosed(workspace.registrationWindow);
  if (!isLocked) {
    throw new RegistrationError("Change requests are only allowed after student registration closes", 400);
  }

  const assignedSubjects = new Set(
    assignments.map((assignment) => assignment.subject.name.toLowerCase()),
  );
  if (assignedSubjects.size === 0) {
    throw new RegistrationError("You are not assigned to any subjects", 403);
  }

  const hasAssignedSubject = workspace.registrations.some((registration) =>
    assignedSubjects.has(registration.subject.name.toLowerCase()),
  );
  if (!hasAssignedSubject) {
    throw new RegistrationError("You can only request changes for your assigned subjects", 403);
  }

  return workspace;
}

async function assertNoDuplicatePendingRequest(input: {
  registrationWorkspaceId: string;
  requestType: RegistrationChangeRequestType;
  targetExamSessionId?: string;
  targetRegistrationId?: string;
  replacementExamSessionId?: string;
}) {
  const base = {
    registrationWorkspaceId: input.registrationWorkspaceId,
    status: RegistrationChangeRequestStatus.PENDING,
  };

  if (input.requestType === RegistrationChangeRequestType.REPLACE_EXAM) {
    const existing = await prisma.registrationChangeRequest.findFirst({
      where: {
        ...base,
        requestType: RegistrationChangeRequestType.REPLACE_EXAM,
        targetRegistrationId: input.targetRegistrationId,
        replacementExamSessionId: input.replacementExamSessionId,
      },
    });
    if (existing) {
      throw new RegistrationError(
        "A pending change request already exists for this student and exam session",
        409,
      );
    }
    return;
  }

  if (input.targetExamSessionId) {
    const existing = await prisma.registrationChangeRequest.findFirst({
      where: {
        ...base,
        targetExamSessionId: input.targetExamSessionId,
      },
    });
    if (existing) {
      throw new RegistrationError(
        "A pending change request already exists for this student and exam session",
        409,
      );
    }
  }
}

export async function listTeacherChangeRequests(teacherId: string) {
  return prisma.registrationChangeRequest.findMany({
    where: { requestedByUserId: teacherId },
    include: changeRequestInclude,
    orderBy: { createdAt: "desc" },
  });
}

export async function listChangeRequestsForReviewer(filters?: {
  status?: RegistrationChangeRequestStatus;
  registrationWindowId?: string;
}) {
  return prisma.registrationChangeRequest.findMany({
    where: {
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.registrationWindowId
        ? { registrationWindowId: filters.registrationWindowId }
        : {}),
    },
    include: changeRequestInclude,
    orderBy: { createdAt: "desc" },
  });
}

export async function submitTeacherLateRegistrationRequest(
  teacher: { id: string; role: UserRole },
  input: {
    studentId: string;
    registrationWindowId: string;
    examSessionIds: string[];
    reason: string;
  },
) {
  if (teacher.role !== UserRole.SUBJECT_TEACHER) {
    throw new RegistrationError("Only subject teachers can submit late registration requests", 403);
  }

  const reason = input.reason?.trim();
  if (!reason) {
    throw new RegistrationError("Reason is required", 400);
  }

  const uniqueSessionIds = [...new Set(input.examSessionIds)];
  const registrationWindow = await prisma.registrationWindow.findUnique({
    where: { id: input.registrationWindowId },
  });
  if (!registrationWindow) {
    throw new RegistrationError("Registration window not found", 404);
  }
  if (!isStudentRegistrationPeriodClosed(registrationWindow)) {
    throw new RegistrationError(
      "Late registration requests are only allowed after student registration closes",
      400,
    );
  }
  if (!canTeacherSubmitChangeRequest(registrationWindow)) {
    throw new RegistrationError("Registration window is closed for teacher change requests", 400);
  }

  await assertLateRegistrationAllowed(input.registrationWindowId, uniqueSessionIds);
  await assertTeacherAssignedToExamSessions(teacher.id, uniqueSessionIds);
  await assertNoDuplicateStudentExamSessions(input.studentId, uniqueSessionIds);
  await assertStudentCanRegister(input.studentId);
  await assertNoDuplicatePendingLateRequest({
    studentId: input.studentId,
    registrationWindowId: input.registrationWindowId,
    examSessionIds: uniqueSessionIds,
  });

  const requestRow = await prisma.registrationChangeRequest.create({
    data: {
      studentId: input.studentId,
      registrationWindowId: input.registrationWindowId,
      requestedByUserId: teacher.id,
      requestedByRole: teacher.role,
      requestType: RegistrationChangeRequestType.LATE_REGISTRATION,
      reason,
      status: RegistrationChangeRequestStatus.PENDING,
      examSessions: {
        create: uniqueSessionIds.map((examSessionId) => ({ examSessionId })),
      },
    },
    include: changeRequestInclude,
  });

  await createRegistrationAuditLog({
    registrationWorkspaceId: requestRow.registrationWorkspaceId,
    studentId: input.studentId,
    performedById: teacher.id,
    performedByRole: teacher.role,
    action: RegistrationAuditAction.TEACHER_LATE_REGISTRATION_REQUEST,
    reason,
    note: `LATE_REGISTRATION:${uniqueSessionIds.length} session(s)`,
    examSessionId: uniqueSessionIds[0],
  });

  return requestRow;
}

export async function submitTeacherChangeRequest(
  teacher: { id: string; role: UserRole },
  input: {
    registrationWorkspaceId: string;
    requestType: RegistrationChangeRequestType;
    targetExamSessionId?: string;
    targetRegistrationId?: string;
    replacementExamSessionId?: string;
    reason: string;
  },
) {
  if (teacher.role !== UserRole.SUBJECT_TEACHER) {
    throw new RegistrationError("Only subject teachers can submit change requests", 403);
  }

  if (input.requestType === RegistrationChangeRequestType.LATE_REGISTRATION) {
    throw new RegistrationError("Use /api/teacher/late-registration-requests for late registration", 400);
  }

  const workspace = await assertTeacherCanRequestChange(teacher.id, input.registrationWorkspaceId);

  if (
    (input.requestType === RegistrationChangeRequestType.ADD_EXAM ||
      input.requestType === RegistrationChangeRequestType.REPLACE_EXAM) &&
    workspace.studentId
  ) {
    await assertStudentCanRegister(workspace.studentId);
  }

  if (input.requestType === RegistrationChangeRequestType.ADD_EXAM && !input.targetExamSessionId) {
    throw new RegistrationError("targetExamSessionId is required for ADD_EXAM", 400);
  }
  if (input.requestType === RegistrationChangeRequestType.REMOVE_EXAM && !input.targetRegistrationId) {
    throw new RegistrationError("targetRegistrationId is required for REMOVE_EXAM", 400);
  }
  if (input.requestType === RegistrationChangeRequestType.REPLACE_EXAM) {
    if (!input.targetRegistrationId || !input.replacementExamSessionId) {
      throw new RegistrationError(
        "targetRegistrationId and replacementExamSessionId are required for REPLACE_EXAM",
        400,
      );
    }
  }

  let targetExamSessionId = input.targetExamSessionId;
  if (
    (input.requestType === RegistrationChangeRequestType.REMOVE_EXAM ||
      input.requestType === RegistrationChangeRequestType.REPLACE_EXAM) &&
    input.targetRegistrationId
  ) {
    const registration = workspace.registrations.find((row) => row.id === input.targetRegistrationId);
    if (!registration) {
      throw new RegistrationError("Target registration not found in this workspace", 400);
    }
    targetExamSessionId = registration.examSessionId;
  }

  await assertNoDuplicatePendingRequest({
    ...input,
    targetExamSessionId,
  });

  const requestRow = await prisma.registrationChangeRequest.create({
    data: {
      registrationWorkspaceId: input.registrationWorkspaceId,
      registrationWindowId: workspace.registrationWindowId,
      studentId: workspace.studentId,
      requestedByUserId: teacher.id,
      requestedByRole: teacher.role,
      requestType: input.requestType,
      targetExamSessionId,
      targetRegistrationId: input.targetRegistrationId,
      replacementExamSessionId: input.replacementExamSessionId,
      reason: input.reason,
      status: RegistrationChangeRequestStatus.PENDING,
    },
    include: changeRequestInclude,
  });

  await createRegistrationAuditLog({
    registrationWorkspaceId: input.registrationWorkspaceId,
    studentId: workspace.studentId,
    performedById: teacher.id,
    performedByRole: teacher.role,
    action: RegistrationAuditAction.TEACHER_CHANGE_REQUEST,
    reason: input.reason,
    note: input.requestType,
    examSessionId:
      targetExamSessionId ??
      input.replacementExamSessionId ??
      workspace.registrations[0]?.examSessionId ??
      "",
  });

  return requestRow;
}

export async function reviewChangeRequest(
  reviewer: { id: string; role: UserRole },
  requestId: string,
  decision: "APPROVED" | "REJECTED",
  reviewNote?: string,
) {
  if (reviewer.role !== UserRole.ADMIN && reviewer.role !== UserRole.EXAM_OFFICER) {
    throw new RegistrationError("Only exam officers or admins can review change requests", 403);
  }

  if (decision === "REJECTED" && !reviewNote?.trim()) {
    throw new RegistrationError("Review note is required when rejecting a change request", 400);
  }

  const requestRow = await prisma.registrationChangeRequest.findUnique({
    where: { id: requestId },
    include: {
      requestedBy: { select: { name: true } },
      examSessions: { select: { examSessionId: true } },
      registrationWorkspace: {
        include: {
          registrations: {
            where: { status: { in: [RegistrationStatus.ACTIVE, RegistrationStatus.LOCKED] } },
          },
        },
      },
    },
  });

  if (!requestRow) {
    throw new RegistrationError("Change request not found", 404);
  }

  if (requestRow.status !== RegistrationChangeRequestStatus.PENDING) {
    throw new RegistrationError("Change request has already been reviewed", 400);
  }

  let resultingWorkspaceId = requestRow.registrationWorkspaceId;

  if (decision === "APPROVED") {
    if (requestRow.requestType === RegistrationChangeRequestType.LATE_REGISTRATION) {
      if (!requestRow.registrationWindowId) {
        throw new RegistrationError("Late registration request is missing registration window", 400);
      }
      const examSessionIds = requestRow.examSessions.map((row) => row.examSessionId);
      const workspace = await applyStaffStudentRegistrationAfterStudentClose(
        { id: reviewer.id, role: reviewer.role },
        {
          studentId: requestRow.studentId ?? undefined,
          candidateId: requestRow.candidateId ?? undefined,
          registrationWindowId: requestRow.registrationWindowId,
          examSessionIds,
          reason: requestRow.reason,
          teacherRequestedBy: {
            name: requestRow.requestedBy.name,
            role: requestRow.requestedByRole,
          },
        },
      );
      if (!workspace) {
        throw new RegistrationError("Could not create late registration workspace", 500);
      }
      resultingWorkspaceId = workspace.id;

      await prisma.registrationChangeRequest.update({
        where: { id: requestId },
        data: { registrationWorkspaceId: workspace.id },
      });
    } else {
      if (!requestRow.registrationWorkspaceId) {
        throw new RegistrationError("Change request is missing registration workspace", 400);
      }
      const addExamSessionIds =
        requestRow.requestType === RegistrationChangeRequestType.ADD_EXAM && requestRow.targetExamSessionId
          ? [requestRow.targetExamSessionId]
          : [];
      const removeRegistrationIds =
        requestRow.requestType === RegistrationChangeRequestType.REMOVE_EXAM && requestRow.targetRegistrationId
          ? [requestRow.targetRegistrationId]
          : [];
      const replacements =
        requestRow.requestType === RegistrationChangeRequestType.REPLACE_EXAM &&
        requestRow.targetRegistrationId &&
        requestRow.replacementExamSessionId
          ? [
              {
                registrationId: requestRow.targetRegistrationId,
                newExamSessionId: requestRow.replacementExamSessionId,
              },
            ]
          : [];

      await applyPostLockAdjustment(
        requestRow.registrationWorkspaceId,
        { id: reviewer.id, role: reviewer.role },
        {
          reason: requestRow.reason,
          addExamSessionIds,
          removeRegistrationIds,
          replacements,
          teacherRequestedBy: {
            name: requestRow.requestedBy.name,
            role: requestRow.requestedByRole,
          },
        },
      );
      resultingWorkspaceId = requestRow.registrationWorkspaceId;
    }
  }

  await prisma.registrationChangeRequest.update({
    where: { id: requestId },
    data: {
      status:
        decision === "APPROVED"
          ? RegistrationChangeRequestStatus.APPROVED
          : RegistrationChangeRequestStatus.REJECTED,
      reviewedByUserId: reviewer.id,
      reviewedAt: new Date(),
      reviewNote: reviewNote?.trim() || null,
    },
  });

  const isLate = requestRow.requestType === RegistrationChangeRequestType.LATE_REGISTRATION;
  const approvedAction = isLate
    ? RegistrationAuditAction.TEACHER_LATE_REGISTRATION_APPROVED
    : RegistrationAuditAction.TEACHER_REQUEST_APPROVED;
  const rejectedAction = isLate
    ? RegistrationAuditAction.TEACHER_LATE_REGISTRATION_REJECTED
    : RegistrationAuditAction.TEACHER_REQUEST_REJECTED;

  await createRegistrationAuditLog({
    registrationWorkspaceId: resultingWorkspaceId,
    studentId: requestRow.studentId,
    performedById: reviewer.id,
    performedByRole: reviewer.role,
    action: decision === "APPROVED" ? approvedAction : rejectedAction,
    reason: requestRow.reason,
    note: reviewNote?.trim() || requestRow.requestType,
    examSessionId:
      requestRow.examSessions[0]?.examSessionId ??
      requestRow.targetExamSessionId ??
      requestRow.replacementExamSessionId ??
      requestRow.registrationWorkspace?.registrations[0]?.examSessionId ??
      "",
  });

  if (!resultingWorkspaceId) {
    throw new RegistrationError("Could not resolve registration workspace after review", 500);
  }

  const { getRegistrationWorkspaceById } = await import("@/lib/registrations/workspace");
  return getRegistrationWorkspaceById(resultingWorkspaceId);
}
