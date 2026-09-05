import {
  RegistrationChangeRequestStatus,
  RegistrationStatus,
  StudentAdjustmentRejectedAtStage,
  StudentAdjustmentRequestItemType,
  StudentAdjustmentRequestStatus,
  UserRole,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { applyPostLockAdjustment } from "@/lib/registrations/adjustment";
import { RegistrationError } from "@/lib/registrations/errors";
import {
  canStudentSubmitAdjustmentRequest,
  resolveStudentAdjustmentRequestCloseAt,
} from "@/lib/registrations/window";
import { needsFeeStatementRegeneration } from "@/lib/fees/workspace-status";
import {
  requireHomeroomTeacherForStudent,
  teacherCanReviewStudentAdjustment,
} from "@/lib/homeroom/class-homeroom";
import { queueStudentAdjustmentTeacherReviewedNotification } from "@/lib/notifications/student-adjustment-teacher-reviewed";

const sessionInclude = {
  paper: {
    include: {
      subject: {
        include: {
          qualification: { include: { examBoard: true } },
        },
      },
    },
  },
  examSeries: true,
} as const;

export const studentAdjustmentRequestInclude = {
  student: { include: { studentProfile: true } },
  candidate: { select: { id: true, englishName: true, studentNumber: true } },
  primaryHomeroomTeacher: { select: { id: true, name: true, role: true } },
  teacherReviewedBy: { select: { id: true, name: true, role: true } },
  eoReviewedBy: { select: { id: true, name: true, role: true } },
  registrationWindow: {
    include: { examBoard: true, examSeries: true },
  },
  registrationWorkspace: {
    include: {
      student: { include: { studentProfile: true } },
      registrationWindow: { include: { examBoard: true, examSeries: true } },
    },
  },
  items: {
    include: {
      targetExamSession: { include: sessionInclude },
    },
    orderBy: { createdAt: "asc" as const },
  },
} as const;

export type StudentAdjustmentSubmitItem =
  | {
      itemType: "REMOVE";
      targetRegistrationId: string;
      studentReason: string;
    }
  | {
      itemType: "ADD";
      targetExamSessionId: string;
      studentReason: string;
    };

async function assertNoPendingStudentAdjustment(workspaceId: string) {
  const pending = await prisma.studentAdjustmentRequest.findFirst({
    where: {
      registrationWorkspaceId: workspaceId,
      status: {
        in: [
          StudentAdjustmentRequestStatus.PENDING_TEACHER,
          StudentAdjustmentRequestStatus.PENDING_EO,
        ],
      },
    },
    select: { id: true },
  });
  if (pending) {
    throw new RegistrationError(
      "A student adjustment request is already pending for this registration",
      409,
    );
  }
}

export async function assertNoPendingStudentAdjustmentForWorkspace(workspaceId: string) {
  await assertNoPendingStudentAdjustment(workspaceId);
}

export async function getPendingStudentAdjustmentForWorkspace(workspaceId: string) {
  return prisma.studentAdjustmentRequest.findFirst({
    where: {
      registrationWorkspaceId: workspaceId,
      status: {
        in: [
          StudentAdjustmentRequestStatus.PENDING_TEACHER,
          StudentAdjustmentRequestStatus.PENDING_EO,
        ],
      },
    },
    include: studentAdjustmentRequestInclude,
    orderBy: { submittedAt: "desc" },
  });
}

export async function listStudentAdjustmentRequestsForStudent(studentId: string) {
  return prisma.studentAdjustmentRequest.findMany({
    where: { studentId },
    include: studentAdjustmentRequestInclude,
    orderBy: { submittedAt: "desc" },
  });
}

export async function listStudentAdjustmentRequestsForReview(filters?: {
  status?: StudentAdjustmentRequestStatus | StudentAdjustmentRequestStatus[];
  registrationWindowId?: string;
  /** When set, only requests the teacher may review (primary or same-grade form teacher). */
  reviewerTeacherId?: string;
}) {
  const statusFilter = filters?.status
    ? Array.isArray(filters.status)
      ? { in: filters.status }
      : filters.status
    : undefined;

  let gradeScope: import("@/generated/prisma/enums").Grade[] | undefined;
  if (filters?.reviewerTeacherId) {
    const assignments = await prisma.classHomeroomTeacher.findMany({
      where: { teacherUserId: filters.reviewerTeacherId },
      select: { grade: true },
    });
    gradeScope = [...new Set(assignments.map((row) => row.grade))];
    if (gradeScope.length === 0) {
      return [];
    }
  }

  const rows = await prisma.studentAdjustmentRequest.findMany({
    where: {
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(filters?.registrationWindowId
        ? { registrationWindowId: filters.registrationWindowId }
        : {}),
      ...(gradeScope
        ? {
            OR: [
              { primaryHomeroomTeacherId: filters!.reviewerTeacherId },
              { studentGradeSnapshot: { in: gradeScope } },
            ],
          }
        : {}),
    },
    include: studentAdjustmentRequestInclude,
    orderBy: { submittedAt: "desc" },
  });

  const removeRegistrationIds = [
    ...new Set(
      rows.flatMap((row) =>
        row.items
          .filter((item) => item.itemType === StudentAdjustmentRequestItemType.REMOVE)
          .map((item) => item.targetRegistrationId)
          .filter((id): id is string => Boolean(id)),
      ),
    ),
  ];

  if (removeRegistrationIds.length === 0) return rows;

  const registrations = await prisma.studentExamRegistration.findMany({
    where: { id: { in: removeRegistrationIds } },
    include: {
      examSession: { include: sessionInclude },
    },
  });
  const sessionByRegistrationId = new Map(
    registrations.map((row) => [row.id, row.examSession]),
  );

  return rows.map((row) => ({
    ...row,
    items: row.items.map((item) => {
      if (
        item.itemType === StudentAdjustmentRequestItemType.REMOVE &&
        item.targetRegistrationId &&
        !item.targetExamSession
      ) {
        return {
          ...item,
          targetExamSession: sessionByRegistrationId.get(item.targetRegistrationId) ?? null,
        };
      }
      return item;
    }),
  }));
}

export async function listAddableSessionsForStudentAdjustment(input: {
  studentId: string;
  workspaceId: string;
  q?: string;
  limit?: number;
}) {
  const workspace = await prisma.registrationWorkspace.findUnique({
    where: { id: input.workspaceId },
    include: {
      registrationWindow: {
        include: {
          includedSeries: { select: { examSeriesId: true } },
        },
      },
      registrations: {
        where: { status: { in: [RegistrationStatus.ACTIVE, RegistrationStatus.LOCKED] } },
        select: { examSessionId: true },
      },
    },
  });

  if (!workspace || workspace.studentId !== input.studentId) {
    throw new RegistrationError("Registration workspace not found", 404);
  }

  const seriesIds = [
    ...new Set([
      workspace.registrationWindow.examSeriesId,
      ...workspace.registrationWindow.includedSeries.map((row) => row.examSeriesId),
    ]),
  ];
  const registeredSessionIds = new Set(workspace.registrations.map((row) => row.examSessionId));

  const sessions = await prisma.examSession.findMany({
    where: { examSeriesId: { in: seriesIds } },
    include: sessionInclude,
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  const available = sessions.filter((session) => !registeredSessionIds.has(session.id));

  if (!input.q?.trim()) {
    return available.slice(0, input.limit ?? 25);
  }

  const { filterExamSessions } = await import("@/lib/exam-session-search");
  return filterExamSessions(available, input.q, input.limit ?? 25);
}

export async function submitStudentAdjustmentRequest(
  student: { id: string },
  input: {
    registrationWorkspaceId: string;
    items: StudentAdjustmentSubmitItem[];
  },
) {
  if (!input.items.length) {
    throw new RegistrationError("Add or remove at least one exam", 400);
  }

  const workspace = await prisma.registrationWorkspace.findUnique({
    where: { id: input.registrationWorkspaceId },
    include: {
      registrationWindow: true,
      registrations: {
        where: { status: { in: [RegistrationStatus.ACTIVE, RegistrationStatus.LOCKED] } },
        select: { id: true, examSessionId: true, status: true },
      },
    },
  });

  if (!workspace || workspace.studentId !== student.id) {
    throw new RegistrationError("Registration workspace not found", 404);
  }

  if (workspace.registrationType !== "INTERNAL_NORMAL") {
    throw new RegistrationError("Late adjustment requests apply only to normal registrations", 400);
  }

  if (!canStudentSubmitAdjustmentRequest(workspace.registrationWindow)) {
    const closeAt = resolveStudentAdjustmentRequestCloseAt(workspace.registrationWindow);
    throw new RegistrationError(
      `Student adjustment requests are not available (deadline ${closeAt.toLocaleString()})`,
      400,
    );
  }

  await assertNoPendingStudentAdjustment(workspace.id);

  const pendingTeacherChange = await prisma.registrationChangeRequest.findFirst({
    where: {
      registrationWorkspaceId: workspace.id,
      status: RegistrationChangeRequestStatus.PENDING,
    },
    select: { id: true },
  });
  if (pendingTeacherChange) {
    throw new RegistrationError(
      "A teacher change request is already pending for this registration",
      409,
    );
  }

  const homeroom = await requireHomeroomTeacherForStudent(student.id);

  const registrationById = new Map(workspace.registrations.map((row) => [row.id, row]));
  const registeredSessionIds = new Set(workspace.registrations.map((row) => row.examSessionId));

  const removes = input.items.filter(
    (item): item is Extract<StudentAdjustmentSubmitItem, { itemType: "REMOVE" }> =>
      item.itemType === "REMOVE",
  );
  const adds = input.items.filter(
    (item): item is Extract<StudentAdjustmentSubmitItem, { itemType: "ADD" }> =>
      item.itemType === "ADD",
  );

  if (removes.length + adds.length !== input.items.length) {
    throw new RegistrationError("Invalid adjustment item type", 400);
  }

  const removeIds = new Set<string>();
  for (const item of removes) {
    const reason = item.studentReason?.trim();
    if (!reason) {
      throw new RegistrationError("A reason is required for each removal", 400);
    }
    if (removeIds.has(item.targetRegistrationId)) {
      throw new RegistrationError("Duplicate remove item", 400);
    }
    removeIds.add(item.targetRegistrationId);
    if (!registrationById.has(item.targetRegistrationId)) {
      throw new RegistrationError("One or more exams to remove were not found", 400);
    }
  }

  const remainingCount = workspace.registrations.length - removeIds.size;
  if (remainingCount + adds.length < 1) {
    throw new RegistrationError("At least one exam must remain after the requested changes", 400);
  }

  const addSessionIds = new Set<string>();
  for (const item of adds) {
    const reason = item.studentReason?.trim();
    if (!reason) {
      throw new RegistrationError("A reason is required for each addition", 400);
    }
    if (addSessionIds.has(item.targetExamSessionId)) {
      throw new RegistrationError("Duplicate add item", 400);
    }
    addSessionIds.add(item.targetExamSessionId);
    if (registeredSessionIds.has(item.targetExamSessionId)) {
      throw new RegistrationError("One or more exams to add are already registered", 400);
    }
  }

  if (addSessionIds.size > 0) {
    const included = await prisma.registrationWindowIncludedSeries.findMany({
      where: { registrationWindowId: workspace.registrationWindowId },
      select: { examSeriesId: true },
    });
    const allowedSeriesIds = new Set([
      workspace.registrationWindow.examSeriesId,
      ...included.map((row) => row.examSeriesId),
    ]);
    const sessions = await prisma.examSession.findMany({
      where: { id: { in: [...addSessionIds] } },
      select: { id: true, examSeriesId: true },
    });
    if (sessions.length !== addSessionIds.size) {
      throw new RegistrationError("One or more exams to add were not found", 400);
    }
    for (const session of sessions) {
      if (!allowedSeriesIds.has(session.examSeriesId)) {
        throw new RegistrationError(
          "Added exams must belong to this registration window’s applicable sessions",
          400,
        );
      }
    }
  }

  const created = await prisma.studentAdjustmentRequest.create({
    data: {
      registrationWorkspaceId: workspace.id,
      registrationWindowId: workspace.registrationWindowId,
      studentId: student.id,
      candidateId: workspace.candidateId,
      status: StudentAdjustmentRequestStatus.PENDING_TEACHER,
      primaryHomeroomTeacherId: homeroom.teacher.id,
      studentGradeSnapshot: homeroom.grade,
      studentClassNameSnapshot: homeroom.className,
      items: {
        create: [
          ...removes.map((item) => ({
            itemType: StudentAdjustmentRequestItemType.REMOVE,
            targetRegistrationId: item.targetRegistrationId,
            studentReason: item.studentReason.trim(),
          })),
          ...adds.map((item) => ({
            itemType: StudentAdjustmentRequestItemType.ADD,
            targetExamSessionId: item.targetExamSessionId,
            studentReason: item.studentReason.trim(),
          })),
        ],
      },
    },
    include: studentAdjustmentRequestInclude,
  });

  return created;
}

export async function reviewStudentAdjustmentAsTeacher(
  teacher: { id: string; role: UserRole },
  requestId: string,
  decision: "APPROVED" | "REJECTED",
  reviewReason: string,
) {
  if (teacher.role !== UserRole.SUBJECT_TEACHER) {
    throw new RegistrationError("Only subject teachers can complete the first approval step", 403);
  }

  const reason = reviewReason?.trim();
  if (!reason) {
    throw new RegistrationError("A review reason is required", 400);
  }

  const requestRow = await prisma.studentAdjustmentRequest.findUnique({
    where: { id: requestId },
    include: { items: true },
  });
  if (!requestRow) {
    throw new RegistrationError("Adjustment request not found", 404);
  }
  if (requestRow.status !== StudentAdjustmentRequestStatus.PENDING_TEACHER) {
    throw new RegistrationError("This request is not awaiting teacher approval", 400);
  }

  const allowed = await teacherCanReviewStudentAdjustment({
    teacherId: teacher.id,
    studentGrade: requestRow.studentGradeSnapshot,
    primaryHomeroomTeacherId: requestRow.primaryHomeroomTeacherId,
  });
  if (!allowed) {
    throw new RegistrationError(
      "Only the class form teacher or another form teacher in the same grade can review this request",
      403,
    );
  }

  const updated =
    decision === "REJECTED"
      ? await prisma.studentAdjustmentRequest.update({
          where: { id: requestId },
          data: {
            status: StudentAdjustmentRequestStatus.REJECTED,
            teacherReviewedByUserId: teacher.id,
            teacherReviewedAt: new Date(),
            teacherReviewReason: reason,
            rejectedAtStage: StudentAdjustmentRejectedAtStage.TEACHER,
          },
          include: studentAdjustmentRequestInclude,
        })
      : await prisma.studentAdjustmentRequest.update({
          where: { id: requestId },
          data: {
            status: StudentAdjustmentRequestStatus.PENDING_EO,
            teacherReviewedByUserId: teacher.id,
            teacherReviewedAt: new Date(),
            teacherReviewReason: reason,
          },
          include: studentAdjustmentRequestInclude,
        });

  queueStudentAdjustmentTeacherReviewedNotification(updated.id);
  return updated;
}

export async function reviewStudentAdjustmentAsEo(
  reviewer: { id: string; role: UserRole },
  requestId: string,
  decision: "APPROVED" | "REJECTED",
  reviewReason: string,
) {
  if (reviewer.role !== UserRole.EXAM_OFFICER && reviewer.role !== UserRole.ADMIN) {
    throw new RegistrationError("Only Exam Officer or Admin can complete the final approval step", 403);
  }

  const reason = reviewReason?.trim();
  if (!reason) {
    throw new RegistrationError("A review reason is required", 400);
  }

  const requestRow = await prisma.studentAdjustmentRequest.findUnique({
    where: { id: requestId },
    include: {
      items: true,
      teacherReviewedBy: { select: { name: true, role: true } },
    },
  });
  if (!requestRow) {
    throw new RegistrationError("Adjustment request not found", 404);
  }
  if (requestRow.status !== StudentAdjustmentRequestStatus.PENDING_EO) {
    throw new RegistrationError("This request is not awaiting Exams Office approval", 400);
  }

  if (decision === "REJECTED") {
    return {
      request: await prisma.studentAdjustmentRequest.update({
        where: { id: requestId },
        data: {
          status: StudentAdjustmentRequestStatus.REJECTED,
          eoReviewedByUserId: reviewer.id,
          eoReviewedAt: new Date(),
          eoReviewReason: reason,
          rejectedAtStage: StudentAdjustmentRejectedAtStage.EO,
        },
        include: studentAdjustmentRequestInclude,
      }),
      feeNeedsRegeneration: false,
    };
  }

  const addExamSessionIds = requestRow.items
    .filter((item) => item.itemType === StudentAdjustmentRequestItemType.ADD)
    .map((item) => item.targetExamSessionId)
    .filter((id): id is string => Boolean(id));
  const removeRegistrationIds = requestRow.items
    .filter((item) => item.itemType === StudentAdjustmentRequestItemType.REMOVE)
    .map((item) => item.targetRegistrationId)
    .filter((id): id is string => Boolean(id));

  const applyReasonParts = [
    reason,
    requestRow.teacherReviewReason
      ? `Teacher approval: ${requestRow.teacherReviewReason}`
      : null,
  ].filter(Boolean);

  await applyPostLockAdjustment(
    requestRow.registrationWorkspaceId,
    { id: reviewer.id, role: reviewer.role },
    {
      reason: applyReasonParts.join(" · "),
      addExamSessionIds,
      removeRegistrationIds,
      teacherRequestedBy: requestRow.teacherReviewedBy
        ? {
            name: requestRow.teacherReviewedBy.name,
            role: requestRow.teacherReviewedBy.role,
          }
        : undefined,
    },
  );

  const updated = await prisma.studentAdjustmentRequest.update({
    where: { id: requestId },
    data: {
      status: StudentAdjustmentRequestStatus.APPROVED,
      eoReviewedByUserId: reviewer.id,
      eoReviewedAt: new Date(),
      eoReviewReason: reason,
    },
    include: studentAdjustmentRequestInclude,
  });

  const refreshedStatements = await prisma.feeStatement.findMany({
    where: {
      registrationWorkspaceId: requestRow.registrationWorkspaceId,
      statementKind: "NORMAL",
    },
    select: { id: true, status: true, generatedAt: true },
  });

  return {
    request: updated,
    feeNeedsRegeneration: needsFeeStatementRegeneration(refreshedStatements),
    registrationWorkspaceId: requestRow.registrationWorkspaceId,
  };
}
