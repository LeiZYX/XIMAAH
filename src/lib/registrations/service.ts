import { RegistrationAuditAction, RegistrationStatus } from "@/generated/prisma/enums";
import type { CandidateType, Grade } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  createRegistrationAuditLog,
  registrationAuditSnapshot,
} from "@/lib/registrations/audit";
import { ensureExpiredWindowsLocked } from "@/lib/registrations/lock";
import { buildStudentVisibleRegistrationWhere } from "@/lib/registrations/filters";
import {
  canRegisterInWindow,
  canStudentEditRegistrationList,
  canStudentRegisterInWindow,
} from "@/lib/registrations/window";
import {
  resolveEntryTypeForRegistration,
  type RegistrationFeeStageRecord,
} from "@/lib/registrations/fee-stages";
import { ensureRegistrationWorkspace } from "@/lib/registrations/workspace";
import { flagsForRegistrationType } from "@/lib/registrations/metadata";
import { hasWorkspaceSchema } from "@/lib/registrations/schema-capabilities";
import { assertStudentCanRegister } from "@/lib/students/archive";
import {
  candidateRegistrationSnapshots,
  syncCandidateFromStudentUser,
} from "@/lib/candidates/service";

import { RegistrationError } from "@/lib/registrations/errors";
import { windowIncludesSeries } from "@/lib/registrations/included-series";
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
      status: "OPEN",
      OR: [
        { examBoardId, examSeriesId: session.examSeriesId },
        {
          includedSeries: {
            some: { examSeriesId: session.examSeriesId },
          },
        },
      ],
    },
    include: {
      includedSeries: {
        select: {
          examSeriesId: true,
          examSeries: { select: { examBoardId: true } },
        },
      },
    },
  });

  return windows.filter(
    (window) =>
      windowIncludesSeries(window, session.examSeriesId, examBoardId) &&
      canRegisterInWindow(window, now),
  );
}

export async function getStudentEligibleWindowsForSession(
  examSessionId: string,
  now = new Date(),
) {
  const openWindows = await getOpenWindowsForSession(examSessionId, now);
  const eligible = [];

  for (const window of openWindows) {
    if (
      canStudentRegisterInWindow(
        { ...window, studentSelfRegistrationEnabled: window.studentSelfRegistrationEnabled ?? true },
        [],
        now,
      )
    ) {
      eligible.push(window);
    }
  }

  return eligible;
}

function buildRegistrationData(
  student: { id: string; name: string; email: string | null; phone: string | null },
  profile: {
    studentNo: string;
    currentGrade: Grade;
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
  candidate: { id: string; assessmentHubCandidateNumber: string; candidateType: CandidateType },
  entry: {
    entryType: import("@/generated/prisma/enums").FeeEntryType;
    feeStageId: string | null;
    entryTypeOverridden: boolean;
  },
) {
  const snapshots = candidateRegistrationSnapshots({
    englishName: student.name,
    studentNumber: profile.studentNo,
    grade: profile.currentGrade,
    className: profile.currentClassName,
    email: profile.email ?? student.email,
    phone: profile.phone ?? student.phone,
    assessmentHubCandidateNumber: candidate.assessmentHubCandidateNumber,
    candidateType: candidate.candidateType,
  });

  return {
    candidateId: candidate.id,
    studentId: student.id,
    examSessionId: session.id,
    registrationWindowId,
    examBoardId: session.paper.subject.qualification.examBoardId,
    examSeriesId: session.examSeriesId,
    subjectId: session.paper.subjectId,
    paperId: session.paper.id,
    ...snapshots,
    status: RegistrationStatus.ACTIVE,
    lockedAt: null,
    cancelledAt: null,
    registrationSource: "STUDENT_SUBMITTED" as const,
    visibility: "STUDENT_AND_TEACHER" as const,
    billingScope: "NORMAL_BILLING" as const,
    registrationType: "INTERNAL_NORMAL" as const,
    ...flagsForRegistrationType("INTERNAL_NORMAL"),
    entryType: entry.entryType,
    feeStageId: entry.feeStageId,
    entryTypeOverridden: entry.entryTypeOverridden,
  };
}

export async function createStudentRegistration(studentId: string, examSessionId: string) {
  await ensureExpiredWindowsLocked();
  await assertStudentCanRegister(studentId);
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

  const openWindows = await getStudentEligibleWindowsForSession(examSessionId, now);
  if (openWindows.length === 0) {
    throw new RegistrationError("No open registration window for this exam", 400);
  }

  const registrationWindow = openWindows[0];
  const feeStages = await prisma.registrationFeeStage.findMany({
    where: { registrationWindowId: registrationWindow.id },
  });
  const entry = resolveEntryTypeForRegistration({
    feeStages: feeStages as RegistrationFeeStageRecord[],
    now,
  });
  const candidate = await syncCandidateFromStudentUser(studentId);
  if (!candidate) {
    throw new RegistrationError("Could not resolve candidate profile", 400);
  }

  const data = buildRegistrationData(
    student,
    student.studentProfile,
    session,
    registrationWindow.id,
    candidate,
    entry,
  );

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
          candidateId: candidate.id,
          studentId,
          registrationId: updated.id,
          examSessionId,
          action: workspaceReady
            ? RegistrationAuditAction.STUDENT_ADD
            : RegistrationAuditAction.UPDATE,
          performedById: studentId,
          performedByRole: workspaceReady ? "STUDENT" : undefined,
          registrationSource: "STUDENT_SUBMITTED",
          registrationType: "INTERNAL_NORMAL",
          visibility: "STUDENT_AND_TEACHER",
          billingScope: "NORMAL_BILLING",
          assessmentHubCandidateNumberSnapshot: candidate.assessmentHubCandidateNumber,
          candidateTypeSnapshot: candidate.candidateType,
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
        candidateId: candidate.id,
        studentId,
        registrationId: created.id,
        examSessionId,
        action: workspaceReady
          ? RegistrationAuditAction.STUDENT_ADD
          : RegistrationAuditAction.ADD,
        performedById: studentId,
        performedByRole: workspaceReady ? "STUDENT" : undefined,
        registrationSource: "STUDENT_SUBMITTED",
        registrationType: "INTERNAL_NORMAL",
        visibility: "STUDENT_AND_TEACHER",
        billingScope: "NORMAL_BILLING",
        assessmentHubCandidateNumberSnapshot: candidate.assessmentHubCandidateNumber,
        candidateTypeSnapshot: candidate.candidateType,
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

  if (
    !canStudentEditRegistrationList(
      registration.registrationWindow,
      [],
    )
  ) {
    throw new RegistrationError(
      "Student registration has closed — contact your subject teacher or the Exams Office to change your list.",
      400,
    );
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
        registrationType: "INTERNAL_NORMAL",
        registrationSource: registration.registrationSource,
        visibility: registration.visibility,
        billingScope: registration.billingScope,
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
    where: buildStudentVisibleRegistrationWhere(studentId),
    include: workspaceReady
      ? {
          ...registrationInclude,
          registrationWorkspace: {
            select: {
              id: true,
              hasPostLockAdjustment: true,
              isLateRegistration: true,
              registrationSource: true,
              visibility: true,
              billingScope: true,
              includeCandidateRegistrationFee: true,
              visibleInStudentBilling: true,
              registrationNumber: true,
              confirmationNumber: true,
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
      { registrationWindow: { studentRegistrationOpenAt: "desc" } },
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
