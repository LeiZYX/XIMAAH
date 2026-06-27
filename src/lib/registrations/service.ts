import { RegistrationAuditAction, RegistrationStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import {
  createRegistrationAuditLog,
  registrationAuditSnapshot,
} from "@/lib/registrations/audit";
import { ensureExpiredWindowsLocked } from "@/lib/registrations/lock";
import { canRegisterInWindow } from "@/lib/registrations/window";
import { ensureRegistrationWorkspace } from "@/lib/registrations/workspace";
import { hasWorkspaceSchema } from "@/lib/registrations/schema-capabilities";

import { RegistrationError } from "@/lib/registrations/errors";
import { registrationInclude } from "@/lib/registrations/include";

export { registrationInclude } from "@/lib/registrations/include";

export async function getOpenWindowsForSession(examSessionId: string, now = new Date()) {
  const session = await prisma.examSession.findUnique({
    where: { id: examSessionId },
    select: {
      examSeriesId: true,
      paper: { select: { subject: { select: { qualification: { select: { examBoardId: true } } } } } },
    },
  });
  if (!session) return [];

  const examBoardId = session.paper.subject.qualification.examBoardId;
  const windows = await prisma.registrationWindow.findMany({
    where: {
      examBoardId,
      examSeriesId: session.examSeriesId,
      status: "OPEN",
    },
  });

  return windows.filter((window) => canRegisterInWindow(window, now));
}

function buildRegistrationData(
  student: { id: string; name: string; email: string | null; phone: string | null },
  profile: {
    studentNo: string;
    currentGrade: string;
    currentClassName: string;
    email: string | null;
    phone: string | null;
  },
  session: {
    id: string;
    examSeriesId: string;
    paper: {
      id: string;
      subjectId: string;
      subject: { qualification: { examBoardId: string } };
    };
  },
  registrationWindowId: string,
) {
  return {
    studentId: student.id,
    examSessionId: session.id,
    registrationWindowId,
    examBoardId: session.paper.subject.qualification.examBoardId,
    examSeriesId: session.examSeriesId,
    subjectId: session.paper.subjectId,
    paperId: session.paper.id,
    studentNameSnapshot: student.name,
    studentNoSnapshot: profile.studentNo,
    gradeSnapshot: profile.currentGrade,
    classNameSnapshot: profile.currentClassName,
    emailSnapshot: profile.email ?? student.email,
    phoneSnapshot: profile.phone ?? student.phone,
    status: RegistrationStatus.ACTIVE,
    lockedAt: null,
    cancelledAt: null,
  };
}

export async function createStudentRegistration(studentId: string, examSessionId: string) {
  await ensureExpiredWindowsLocked();
  const now = new Date();

  const [student, session, existing] = await Promise.all([
    prisma.user.findUnique({
      where: { id: studentId },
      include: { studentProfile: true },
    }),
    prisma.examSession.findUnique({
      where: { id: examSessionId },
      include: {
        examSeries: true,
        paper: {
          include: {
            subject: {
              include: { qualification: true },
            },
          },
        },
      },
    }),
    prisma.studentExamRegistration.findUnique({
      where: {
        studentId_examSessionId: { studentId, examSessionId },
      },
    }),
  ]);

  if (!student || student.role !== "STUDENT") {
    throw new RegistrationError("Student account required", 403);
  }

  if (!student.studentProfile) {
    throw new RegistrationError("Student profile is required before registration", 400);
  }

  if (!session) {
    throw new RegistrationError("Exam session not found", 404);
  }

  if (existing?.status === RegistrationStatus.ACTIVE) {
    throw new RegistrationError("Already registered for this exam session", 409);
  }

  if (existing?.status === RegistrationStatus.LOCKED) {
    throw new RegistrationError("Registration is locked for this exam session", 409);
  }

  const openWindows = await getOpenWindowsForSession(examSessionId, now);
  if (openWindows.length === 0) {
    throw new RegistrationError("No open registration window for this exam", 400);
  }

  const registrationWindow = openWindows[0];
  const data = buildRegistrationData(student, student.studentProfile, session, registrationWindow.id);

  if (existing?.status === RegistrationStatus.CANCELLED) {
    return prisma.$transaction(async (tx) => {
      const workspaceReady = await hasWorkspaceSchema();
      const workspace = workspaceReady
        ? await ensureRegistrationWorkspace(studentId, registrationWindow.id)
        : null;
      const updated = await tx.studentExamRegistration.update({
        where: { id: existing.id },
        data: workspace
          ? { ...data, registrationWorkspaceId: workspace.id }
          : data,
        include: registrationInclude,
      });

      await createRegistrationAuditLog(
        {
          registrationWorkspaceId: workspace?.id,
          studentId,
          registrationId: updated.id,
          examSessionId,
          action: workspaceReady
            ? RegistrationAuditAction.STUDENT_ADD
            : RegistrationAuditAction.UPDATE,
          performedById: studentId,
          performedByRole: workspaceReady ? "STUDENT" : undefined,
          beforeValue: registrationAuditSnapshot(existing),
          afterValue: registrationAuditSnapshot(updated),
          note: "Re-added to registration list",
        },
        tx,
      );

      return updated;
    });
  }

  return prisma.$transaction(async (tx) => {
    const workspaceReady = await hasWorkspaceSchema();
    const workspace = workspaceReady
      ? await ensureRegistrationWorkspace(studentId, registrationWindow.id)
      : null;
    const created = await tx.studentExamRegistration.create({
      data: workspace ? { ...data, registrationWorkspaceId: workspace.id } : data,
      include: registrationInclude,
    });

    await createRegistrationAuditLog(
      {
        registrationWorkspaceId: workspace?.id,
        studentId,
        registrationId: created.id,
        examSessionId,
        action: workspaceReady
          ? RegistrationAuditAction.STUDENT_ADD
          : RegistrationAuditAction.ADD,
        performedById: studentId,
        performedByRole: workspaceReady ? "STUDENT" : undefined,
        afterValue: registrationAuditSnapshot(created),
      },
      tx,
    );

    return created;
  });
}

export async function cancelStudentRegistration(studentId: string, registrationId: string) {
  await ensureExpiredWindowsLocked();

  const registration = await prisma.studentExamRegistration.findUnique({
    where: { id: registrationId },
    include: { registrationWindow: true },
  });

  if (!registration || registration.studentId !== studentId) {
    throw new RegistrationError("Registration not found", 404);
  }

  if (registration.status === RegistrationStatus.CANCELLED) {
    throw new RegistrationError("Registration already removed", 400);
  }

  if (registration.status === RegistrationStatus.LOCKED) {
    throw new RegistrationError("Locked registrations cannot be changed", 400);
  }

  if (registration.status !== RegistrationStatus.ACTIVE) {
    throw new RegistrationError("Registration cannot be changed", 400);
  }

  if (!canRegisterInWindow(registration.registrationWindow)) {
    throw new RegistrationError("Registration window is closed", 400);
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.studentExamRegistration.update({
      where: { id: registrationId },
      data: {
        status: RegistrationStatus.CANCELLED,
        cancelledAt: new Date(),
      },
      include: registrationInclude,
    });

    await createRegistrationAuditLog(
      {
        registrationWorkspaceId: registration.registrationWorkspaceId,
        studentId,
        registrationId,
        examSessionId: registration.examSessionId,
        action: (await hasWorkspaceSchema())
          ? RegistrationAuditAction.STUDENT_REMOVE
          : RegistrationAuditAction.CANCEL,
        performedById: studentId,
        performedByRole: (await hasWorkspaceSchema()) ? "STUDENT" : undefined,
        beforeValue: registrationAuditSnapshot(registration),
        afterValue: registrationAuditSnapshot(updated),
      },
      tx,
    );

    return updated;
  });
}

export async function listStudentVisibleRegistrations(studentId: string) {
  await ensureExpiredWindowsLocked();
  const workspaceReady = await hasWorkspaceSchema();

  if (workspaceReady) {
    const { backfillRegistrationWorkspaces } = await import("@/lib/registrations/workspace");
    await backfillRegistrationWorkspaces();
  }

  const rows = await prisma.studentExamRegistration.findMany({
    where: {
      studentId,
      status: { in: [RegistrationStatus.ACTIVE, RegistrationStatus.LOCKED] },
    },
    include: workspaceReady
      ? {
          ...registrationInclude,
          registrationWorkspace: {
            select: {
              id: true,
              hasPostLockAdjustment: true,
              isLateRegistration: true,
              lastAdjustedAt: true,
              lastAdjustedByRole: true,
              lastAdjustmentReason: true,
              lastAdjustmentSummary: true,
              lastAdjustedByUser: { select: { name: true } },
            },
          },
        }
      : registrationInclude,
    orderBy: [
      { registrationWindow: { startAt: "desc" } },
      { updatedAt: "desc" },
    ],
  });

  if (!workspaceReady) return rows;

  type RowWithWorkspace = (typeof rows)[number] & {
    registrationWorkspace: {
      id: string;
      hasPostLockAdjustment: boolean;
      lastAdjustedAt: Date | null;
      lastAdjustedByRole: string | null;
      lastAdjustmentReason: string | null;
      lastAdjustmentSummary: string | null;
      lastAdjustedByUser: { name: string } | null;
    } | null;
  };

  const workspaceRows = rows as RowWithWorkspace[];
  const { loadPostLockAdjustmentHistoryForWorkspaces } = await import("@/lib/registrations/workspace");
  const workspaceIds = workspaceRows
    .map((row) => row.registrationWorkspace?.id)
    .filter((id): id is string => Boolean(id));
  const historyByWorkspace = await loadPostLockAdjustmentHistoryForWorkspaces(workspaceIds);

  return workspaceRows.map((row) => {
    const workspaceId = row.registrationWorkspace?.id;
    if (!workspaceId || !row.registrationWorkspace) return row;
    return {
      ...row,
      registrationWorkspace: {
        ...row.registrationWorkspace,
        postLockAdjustments: historyByWorkspace.get(workspaceId) ?? [],
      },
    };
  });
}

export { RegistrationError } from "@/lib/registrations/errors";
export { ensureExpiredWindowsLocked } from "@/lib/registrations/lock";
