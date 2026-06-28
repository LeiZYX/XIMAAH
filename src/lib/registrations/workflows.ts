import type { Candidate } from "@/generated/prisma/client";
import type { UserRole } from "@/generated/prisma/enums";
import {
  RegistrationAuditAction,
  RegistrationStatus,
} from "@/generated/prisma/enums";
import {
  candidateRegistrationSnapshots,
  createExternalCandidate,
  resolveCandidateForRegistration,
} from "@/lib/candidates/service";
import { prisma } from "@/lib/prisma";
import {
  createRegistrationAuditLog,
  registrationAuditSnapshot,
} from "@/lib/registrations/audit";
import { RegistrationError } from "@/lib/registrations/errors";
import { registrationInclude } from "@/lib/registrations/include";
import {
  assistedAuditActionForRole,
  assistedSourceForRole,
  officeOnlyAuditActionForRole,
  officeOnlySourceForRole,
} from "@/lib/registrations/metadata";
import { canRegisterInWindow } from "@/lib/registrations/window";
import {
  ensureRegistrationWorkspaceForCandidate,
  getRegistrationWorkspaceById,
} from "@/lib/registrations/workspace";
import { markStatementsNeedReview } from "@/lib/fees/statement";
import { assertStudentCanRegister } from "@/lib/students/archive";

export interface StaffRegistrationInput {
  candidateId?: string;
  studentId?: string;
  registrationWindowId: string;
  examSessionIds: string[];
  reason: string;
  teacherRequestedBy?: { name: string; role: UserRole };
}

export interface ExternalCandidateRegistrationInput {
  candidateId?: string;
  newCandidate?: {
    englishName: string;
    chineseName?: string;
    email?: string;
    phone?: string;
    dateOfBirth?: string;
    gender?: string;
    idNumber?: string;
    passportNumber?: string;
    schoolName?: string;
    assessmentHubCandidateNumber?: string;
    externalId?: string;
  };
  registrationWindowId: string;
  examSessionIds: string[];
  reason: string;
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

async function loadSessionsForWindow(registrationWindowId: string, examSessionIds: string[]) {
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

async function assertNoDuplicateSessions(candidateId: string, examSessionIds: string[]) {
  const existing = await prisma.studentExamRegistration.findMany({
    where: {
      candidateId,
      examSessionId: { in: examSessionIds },
      status: { in: [RegistrationStatus.ACTIVE, RegistrationStatus.LOCKED] },
    },
    include: { paper: true },
  });

  if (existing.length > 0) {
    const codes = existing.map((row) => row.paper.code).join(", ");
    throw new RegistrationError(`Candidate is already registered for: ${codes}`, 409);
  }
}

async function resolveInternalCandidate(input: StaffRegistrationInput) {
  const candidateId = input.candidateId;
  const studentId = input.studentId;
  if (!candidateId && !studentId) {
    throw new RegistrationError("Internal candidate is required", 400);
  }

  const candidate = await resolveCandidateForRegistration({ candidateId, studentId });
  if (candidate.candidateType !== "INTERNAL") {
    throw new RegistrationError("Assisted registration requires an internal candidate", 400);
  }
  if (candidate.status !== "ACTIVE") {
    throw new RegistrationError("Candidate is not active", 400);
  }
  if (candidate.userId) {
    await assertStudentCanRegister(candidate.userId);
  }
  return candidate;
}

interface WorkflowMetadata {
  visibility: "STUDENT_AND_TEACHER" | "EXAM_OFFICE_ONLY";
  billingScope: "NORMAL_BILLING" | "MANUAL_REVIEW";
  auditAction: RegistrationAuditAction;
  registrationSource: ReturnType<typeof assistedSourceForRole> | ReturnType<typeof officeOnlySourceForRole>;
  lockImmediately: boolean;
  requireInternal: boolean;
}

async function applyCandidateRegistrationWorkflow(
  performedBy: { id: string; role: UserRole },
  candidate: Candidate,
  input: { registrationWindowId: string; examSessionIds: string[]; reason: string },
  metadata: WorkflowMetadata,
) {
  if (!["ADMIN", "EXAM_OFFICER"].includes(performedBy.role)) {
    throw new RegistrationError("Only Admin or Exam Officer can create staff registrations", 403);
  }

  const reason = input.reason?.trim();
  if (!reason) throw new RegistrationError("Reason is required", 400);

  if (metadata.requireInternal && candidate.candidateType !== "INTERNAL") {
    throw new RegistrationError("This workflow requires an internal candidate", 400);
  }

  const uniqueSessionIds = [...new Set(input.examSessionIds)];
  const { window, sessions } = await loadSessionsForWindow(input.registrationWindowId, uniqueSessionIds);
  await assertNoDuplicateSessions(candidate.id, uniqueSessionIds);

  const windowOpen = window.status === "OPEN" && canRegisterInWindow(window);
  const lockImmediately = metadata.lockImmediately || !windowOpen;
  const now = new Date();
  const snapshots = candidateRegistrationSnapshots(candidate);
  const studentId = candidate.userId ?? null;

  let workspace = await ensureRegistrationWorkspaceForCandidate(
    candidate.id,
    window.id,
    studentId,
  );

  await prisma.$transaction(async (tx) => {
    workspace = await tx.registrationWorkspace.update({
      where: { id: workspace!.id },
      data: {
        candidateId: candidate.id,
        studentId,
        registrationSource: metadata.registrationSource,
        visibility: metadata.visibility,
        billingScope: metadata.billingScope,
        lockedAt: lockImmediately ? now : null,
        isLateRegistration: lockImmediately && !windowOpen,
        lastAdjustedByUserId: performedBy.id,
        lastAdjustedByRole: performedBy.role,
        lastAdjustedAt: now,
        lastAdjustmentReason: reason,
      },
    });

    for (const session of sessions) {
      const row = await tx.studentExamRegistration.create({
        data: {
          candidateId: candidate.id,
          studentId,
          registrationWorkspaceId: workspace!.id,
          examSessionId: session.id,
          registrationWindowId: window.id,
          examBoardId: window.examBoardId,
          examSeriesId: window.examSeriesId,
          subjectId: session.paper.subjectId,
          paperId: session.paper.id,
          ...snapshots,
          status: lockImmediately ? RegistrationStatus.LOCKED : RegistrationStatus.ACTIVE,
          lockedAt: lockImmediately ? now : null,
          registrationSource: metadata.registrationSource,
          visibility: metadata.visibility,
          billingScope: metadata.billingScope,
          addedByUserId: performedBy.id,
          addedByRole: performedBy.role,
          addedAt: now,
          reason,
        },
        include: registrationInclude,
      });

      await createRegistrationAuditLog(
        {
          registrationWorkspaceId: workspace!.id,
          candidateId: candidate.id,
          studentId,
          registrationId: row.id,
          examSessionId: session.id,
          action: metadata.auditAction,
          performedById: performedBy.id,
          performedByRole: performedBy.role,
          reason,
          registrationSource: metadata.registrationSource,
          visibility: metadata.visibility,
          billingScope: metadata.billingScope,
          assessmentHubCandidateNumberSnapshot: candidate.assessmentHubCandidateNumber,
          candidateTypeSnapshot: candidate.candidateType,
          afterValue: registrationAuditSnapshot(row),
          note: examLine(row.examSession).paperCode,
        },
        tx,
      );
    }
  });

  if (metadata.billingScope === "MANUAL_REVIEW") {
    await markStatementsNeedReview(workspace!.id);
  }

  return getRegistrationWorkspaceById(workspace!.id);
}

export async function applyAssistedRegistration(
  performedBy: { id: string; role: UserRole },
  input: StaffRegistrationInput,
) {
  const candidate = await resolveInternalCandidate(input);
  return applyCandidateRegistrationWorkflow(
    performedBy,
    candidate,
    input,
    {
      visibility: "STUDENT_AND_TEACHER",
      billingScope: "NORMAL_BILLING",
      auditAction: assistedAuditActionForRole(performedBy.role) as RegistrationAuditAction,
      registrationSource: assistedSourceForRole(performedBy.role),
      lockImmediately: false,
      requireInternal: true,
    },
  );
}

export async function applyOfficeOnlyInternalRegistration(
  performedBy: { id: string; role: UserRole },
  input: StaffRegistrationInput,
) {
  const candidate = await resolveInternalCandidate(input);
  return applyCandidateRegistrationWorkflow(
    performedBy,
    candidate,
    input,
    {
      visibility: "EXAM_OFFICE_ONLY",
      billingScope: "MANUAL_REVIEW",
      auditAction: officeOnlyAuditActionForRole(performedBy.role) as RegistrationAuditAction,
      registrationSource: officeOnlySourceForRole(performedBy.role),
      lockImmediately: true,
      requireInternal: true,
    },
  );
}

export async function applyExternalCandidateRegistration(
  performedBy: { id: string; role: UserRole },
  input: ExternalCandidateRegistrationInput,
) {
  let candidate: Candidate;
  if (input.candidateId) {
    const existing = await prisma.candidate.findUnique({ where: { id: input.candidateId } });
    if (!existing || existing.candidateType !== "EXTERNAL") {
      throw new RegistrationError("External candidate not found", 404);
    }
    candidate = existing;
  } else if (input.newCandidate?.englishName?.trim()) {
    candidate = await createExternalCandidate({
      ...input.newCandidate,
      dateOfBirth: input.newCandidate.dateOfBirth
        ? new Date(input.newCandidate.dateOfBirth)
        : undefined,
    });
  } else {
    throw new RegistrationError("Select or create an external candidate", 400);
  }

  return applyCandidateRegistrationWorkflow(
    performedBy,
    candidate,
    input,
    {
      visibility: "EXAM_OFFICE_ONLY",
      billingScope: "MANUAL_REVIEW",
      auditAction: "EXTERNAL_CANDIDATE_REGISTRATION_CREATED" as RegistrationAuditAction,
      registrationSource: "EXTERNAL_CANDIDATE",
      lockImmediately: true,
      requireInternal: false,
    },
  );
}

/** @deprecated */
export async function applyOfficeOnlyRegistration(
  performedBy: { id: string; role: UserRole },
  input: StaffRegistrationInput,
) {
  return applyOfficeOnlyInternalRegistration(performedBy, input);
}

export async function assertLateRegistrationAllowed(
  registrationWindowId: string,
  examSessionIds: string[],
) {
  return loadSessionsForWindow(registrationWindowId, examSessionIds);
}

export async function assertNoDuplicateStudentExamSessions(
  studentId: string,
  examSessionIds: string[],
) {
  const candidate = await resolveCandidateForRegistration({ studentId });
  return assertNoDuplicateSessions(candidate.id, examSessionIds);
}

export async function applyLateRegistration(
  performedBy: { id: string; role: UserRole },
  input: StaffRegistrationInput,
) {
  const window = await prisma.registrationWindow.findUnique({
    where: { id: input.registrationWindowId },
  });
  if (!window) throw new RegistrationError("Registration window not found", 404);
  if (window.status !== "CLOSED") {
    throw new RegistrationError("Late registration is only allowed for closed registration windows", 400);
  }

  const result = await applyAssistedRegistration(performedBy, input);
  if (result) {
    const now = new Date();
    await prisma.registrationWorkspace.update({
      where: { id: result.id },
      data: { isLateRegistration: true, lockedAt: now },
    });
    await prisma.studentExamRegistration.updateMany({
      where: { registrationWorkspaceId: result.id },
      data: { status: RegistrationStatus.LOCKED, lockedAt: now },
    });
  }
  return getRegistrationWorkspaceById(result!.id);
}
