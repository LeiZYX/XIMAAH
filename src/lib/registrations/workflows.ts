import type { Candidate } from "@/generated/prisma/client";
import type { UserRole } from "@/generated/prisma/enums";
import {
  RegistrationAuditAction,
  RegistrationSource,
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
import { windowIncludesSeries } from "@/lib/registrations/included-series";
import { registrationInclude } from "@/lib/registrations/include";
import {
  assistedSourceForRole,
  flagsForRegistrationType,
  internalNormalWorkspaceAuditAction,
  restrictedAuditActionForRole,
  restrictedSourceForRole,
} from "@/lib/registrations/metadata";
import type { RegistrationType } from "@/generated/prisma/enums";
import { formatRegistrationAuditNote } from "@/lib/registrations/audit-payload";
import {
  isRegistrationWindowOpenForStaff,
  isStudentRegistrationPeriodClosed,
} from "@/lib/registrations/window";
import { applyLockedRegistrationAdjustment } from "@/lib/registrations/locked-registration-adjustment";
import {
  resolveEntryTypeForRegistration,
  type RegistrationFeeStageRecord,
} from "@/lib/registrations/fee-stages";
import {
  ensureRegistrationWorkspaceForCandidate,
  getRegistrationWorkspaceById,
} from "@/lib/registrations/workspace";
import { markFeeStatementsNeedsRegeneration } from "@/lib/fees/statement";
import { applyCandidateRegistrationFeeSelection } from "@/lib/fees/candidate-registration-fee";
import { assertStudentCanRegister } from "@/lib/students/archive";
import { generateConfirmationNumber } from "@/lib/registrations/numbering";

export interface StaffRegistrationInput {
  candidateId?: string;
  studentId?: string;
  registrationWindowId: string;
  examSessionIds: string[];
  reason: string;
  entryTypeOverride?: import("@/generated/prisma/enums").FeeEntryType;
  includeCandidateRegistrationFee?: boolean;
  candidateRegistrationFeeReason?: string;
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
  reason?: string;
  includeCandidateRegistrationFee?: boolean;
  candidateRegistrationFeeReason?: string;
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
    include: {
      examBoard: true,
      examSeries: true,
      includedSeries: {
        select: {
          examSeriesId: true,
          examSeries: { select: { examBoardId: true } },
        },
      },
    },
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
    const boardId = session.paper.subject.qualification.examBoardId;
    if (!windowIncludesSeries(window, session.examSeriesId, boardId)) {
      throw new RegistrationError(
        `Exam session ${session.paper.code} is not included in the selected registration window`,
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
  billingScope: "NORMAL_BILLING" | "RESTRICTED_BILLING" | "EXTERNAL_BILLING" | "MANUAL_REVIEW";
  registrationType: RegistrationType;
  auditAction: RegistrationAuditAction;
  sessionAuditAction?: RegistrationAuditAction;
  recordWorkspaceAudit?: boolean;
  registrationSource: RegistrationSource;
  lockImmediately: boolean;
  requireInternal: boolean;
  requireReason?: boolean;
  trackRestrictedMetadata?: boolean;
}

function workspaceAuditNote(
  registrationType: RegistrationType,
  registrationNumber: string | null | undefined,
): string {
  if (registrationType === "RESTRICTED_INTERNAL") {
    return formatRegistrationAuditNote(
      registrationType,
      registrationNumber ? `Registration #: ${registrationNumber}` : "Registration created",
    );
  }
  if (registrationType === "EXTERNAL") {
    return formatRegistrationAuditNote(
      registrationType,
      registrationNumber ? `Registration #: ${registrationNumber}` : "Registration created",
    );
  }
  return registrationNumber
    ? `Registration #: ${registrationNumber}`
    : "Registered on behalf of internal student";
}

function sessionAuditNote(registrationType: RegistrationType, paperCode: string): string {
  return formatRegistrationAuditNote(registrationType, paperCode);
}

async function applyCandidateRegistrationWorkflow(
  performedBy: { id: string; role: UserRole },
  candidate: Candidate,
  input: {
    registrationWindowId: string;
    examSessionIds: string[];
    reason?: string;
    entryTypeOverride?: import("@/generated/prisma/enums").FeeEntryType;
    includeCandidateRegistrationFee?: boolean;
    candidateRegistrationFeeReason?: string;
  },
  metadata: WorkflowMetadata,
) {
  if (!["ADMIN", "EXAM_OFFICER"].includes(performedBy.role)) {
    throw new RegistrationError("Only Admin or Exam Officer can create staff registrations", 403);
  }

  const reason = input.reason?.trim() ?? "";
  if (metadata.requireReason !== false && !reason) {
    throw new RegistrationError("Reason is required", 400);
  }

  if (metadata.requireInternal && candidate.candidateType !== "INTERNAL") {
    throw new RegistrationError("This workflow requires an internal candidate", 400);
  }
  if (metadata.registrationType === "EXTERNAL" && candidate.candidateType !== "EXTERNAL") {
    throw new RegistrationError("External registration requires an external candidate", 400);
  }

  const uniqueSessionIds = [...new Set(input.examSessionIds)];
  const { window, sessions } = await loadSessionsForWindow(input.registrationWindowId, uniqueSessionIds);
  await assertNoDuplicateSessions(candidate.id, uniqueSessionIds);

  const now = new Date();
  const feeStages = await prisma.registrationFeeStage.findMany({
    where: { registrationWindowId: window.id },
    orderBy: { sequence: "asc" },
  });

  const windowOpen = isRegistrationWindowOpenForStaff(window, now);
  if (!windowOpen) {
    throw new RegistrationError("Registration window is closed for staff actions", 400);
  }

  const studentPeriodClosed = isStudentRegistrationPeriodClosed(window, now);
  if (studentPeriodClosed && !reason) {
    throw new RegistrationError("Reason is required after student registration closes", 400);
  }

  const staffOverrideAllowed = ["ADMIN", "EXAM_OFFICER"].includes(performedBy.role);

  const entryResolution = resolveEntryTypeForRegistration({
    feeStages: feeStages as RegistrationFeeStageRecord[],
    now,
    overrideEntryType: input.entryTypeOverride,
    allowOverride: staffOverrideAllowed && Boolean(input.entryTypeOverride),
  });

  const lockImmediately =
    metadata.lockImmediately || studentPeriodClosed;
  const snapshots = candidateRegistrationSnapshots(candidate);
  const studentId = candidate.userId ?? null;

  let workspace = await ensureRegistrationWorkspaceForCandidate(
    candidate.id,
    window.id,
    studentId,
    metadata.registrationType,
  );

  const visibilityFlags = flagsForRegistrationType(metadata.registrationType);

  await prisma.$transaction(async (tx) => {
    workspace = await tx.registrationWorkspace.update({
      where: { id: workspace!.id },
      data: {
        candidateId: candidate.id,
        studentId,
        registrationSource: metadata.registrationSource,
        visibility: metadata.visibility,
        billingScope: metadata.billingScope,
        registrationType: metadata.registrationType,
        ...visibilityFlags,
        ...(metadata.trackRestrictedMetadata
          ? {
              restrictedReason: reason,
              restrictedCreatedById: performedBy.id,
              restrictedCreatedAt: now,
              restrictedUpdatedById: performedBy.id,
              restrictedUpdatedAt: now,
            }
          : { reason }),
        lockedAt: lockImmediately ? now : null,
        ...(lockImmediately && !workspace!.confirmationNumber
          ? {
              confirmationNumber: await generateConfirmationNumber(
                metadata.registrationType,
                now.getFullYear(),
                tx,
              ),
            }
          : {}),
        isLateRegistration: entryResolution.isLateRegistration,
        entryType: entryResolution.entryType,
        feeStageId: entryResolution.feeStageId,
        entryTypeOverridden: entryResolution.entryTypeOverridden,
        entryTypeOverrideReason: entryResolution.entryTypeOverridden ? reason : null,
        lastAdjustedByUserId: performedBy.id,
        lastAdjustedByRole: performedBy.role,
        lastAdjustedAt: now,
        lastAdjustmentReason: reason,
      },
    });

    for (const session of sessions) {
      const sessionAuditAction =
        metadata.sessionAuditAction ??
        (entryResolution.entryTypeOverridden
          ? RegistrationAuditAction.ENTRY_TYPE_OVERRIDDEN
          : metadata.auditAction);

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
          registrationType: metadata.registrationType,
          ...visibilityFlags,
          addedByUserId: performedBy.id,
          addedByRole: performedBy.role,
          addedAt: now,
          reason,
          entryType: entryResolution.entryType,
          feeStageId: entryResolution.feeStageId,
          entryTypeOverridden: entryResolution.entryTypeOverridden,
          entryTypeOverrideReason: entryResolution.entryTypeOverridden ? reason : null,
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
          action: sessionAuditAction,
          performedById: performedBy.id,
          performedByRole: performedBy.role,
          reason,
          registrationSource: metadata.registrationSource,
          registrationType: metadata.registrationType,
          visibility: metadata.visibility,
          billingScope: metadata.billingScope,
          entryType: entryResolution.entryType,
          feeStageId: entryResolution.feeStageId,
          assessmentHubCandidateNumberSnapshot: candidate.assessmentHubCandidateNumber,
          candidateTypeSnapshot: candidate.candidateType,
          afterValue: registrationAuditSnapshot(row),
          note: sessionAuditNote(
            metadata.registrationType,
            examLine(row.examSession).paperCode,
          ),
          registrationWindowId: window.id,
        },
        tx,
      );

      if (!entryResolution.entryTypeOverridden) {
        await createRegistrationAuditLog(
          {
            registrationWorkspaceId: workspace!.id,
            candidateId: candidate.id,
            studentId,
            registrationId: row.id,
            examSessionId: session.id,
            feeStageId: entryResolution.feeStageId,
            action: entryResolution.defaultedToNormal
              ? RegistrationAuditAction.ENTRY_TYPE_DEFAULTED_TO_NORMAL
              : RegistrationAuditAction.ENTRY_TYPE_AUTO_ASSIGNED,
            performedById: performedBy.id,
            performedByRole: performedBy.role,
            entryType: entryResolution.entryType,
            reason,
            registrationSource: metadata.registrationSource,
            registrationType: metadata.registrationType,
            visibility: metadata.visibility,
            billingScope: metadata.billingScope,
            note: entryResolution.entryType,
            skipReasonCheck: true,
          },
          tx,
        );
      }
    }

    if (metadata.recordWorkspaceAudit) {
      const workspaceRecord = await tx.registrationWorkspace.findUnique({
        where: { id: workspace!.id },
        select: { registrationNumber: true },
      });
      await createRegistrationAuditLog(
        {
          registrationWorkspaceId: workspace!.id,
          candidateId: candidate.id,
          studentId,
          registrationId: null,
          examSessionId: null,
          action: metadata.auditAction,
          performedById: performedBy.id,
          performedByRole: performedBy.role,
          reason,
          registrationSource: metadata.registrationSource,
          registrationType: metadata.registrationType,
          visibility: metadata.visibility,
          billingScope: metadata.billingScope,
          registrationNumber: workspaceRecord?.registrationNumber ?? null,
          assessmentHubCandidateNumberSnapshot: candidate.assessmentHubCandidateNumber,
          candidateTypeSnapshot: candidate.candidateType,
          registrationWindowId: window.id,
          note: workspaceAuditNote(metadata.registrationType, workspaceRecord?.registrationNumber),
          afterValue: {
            examSessionIds: uniqueSessionIds,
          },
        },
        tx,
      );
    }

    if (input.includeCandidateRegistrationFee) {
      try {
        await applyCandidateRegistrationFeeSelection({
          workspaceId: workspace!.id,
          includeCandidateRegistrationFee: true,
          performedBy,
          reason: input.candidateRegistrationFeeReason?.trim() || reason,
          tx,
        });
      } catch (feeError) {
        console.warn(
          "Candidate registration fee could not be applied; registration was still created",
          feeError,
        );
      }
    }
  });

  if (input.includeCandidateRegistrationFee || metadata.billingScope === "MANUAL_REVIEW") {
    await markFeeStatementsNeedsRegeneration({
      workspaceId: workspace!.id,
      reasonCode: input.includeCandidateRegistrationFee
        ? "CANDIDATE_REGISTRATION_FEE_ADDED"
        : "MANUAL_BILLING_ADJUSTMENT",
      performedByUserId: performedBy.id,
      note: reason,
    });
  }

  return getRegistrationWorkspaceById(workspace!.id);
}

export async function applyAssistedRegistration(
  performedBy: { id: string; role: UserRole },
  input: StaffRegistrationInput,
) {
  if (!["ADMIN", "EXAM_OFFICER"].includes(performedBy.role)) {
    throw new RegistrationError("Only Admin or Exam Officer can register on behalf of a student", 403);
  }

  const candidate = await resolveInternalCandidate(input);
  return applyCandidateRegistrationWorkflow(
    performedBy,
    candidate,
    input,
    {
      visibility: "STUDENT_AND_TEACHER",
      billingScope: "NORMAL_BILLING",
      registrationType: "INTERNAL_NORMAL",
      auditAction: internalNormalWorkspaceAuditAction(),
      sessionAuditAction: RegistrationAuditAction.ADD,
      recordWorkspaceAudit: true,
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
  if (!["ADMIN", "EXAM_OFFICER"].includes(performedBy.role)) {
    throw new RegistrationError(
      "Only Admin or Exam Officer can create restricted internal registrations",
      403,
    );
  }

  const candidate = await resolveInternalCandidate(input);
  return applyCandidateRegistrationWorkflow(
    performedBy,
    candidate,
    input,
    {
      visibility: "EXAM_OFFICE_ONLY",
      billingScope: "RESTRICTED_BILLING",
      registrationType: "RESTRICTED_INTERNAL",
      auditAction: restrictedAuditActionForRole(performedBy.role) as RegistrationAuditAction,
      sessionAuditAction: RegistrationAuditAction.ADD,
      recordWorkspaceAudit: true,
      registrationSource: restrictedSourceForRole(performedBy.role),
      lockImmediately: true,
      requireInternal: true,
      trackRestrictedMetadata: true,
    },
  );
}

export async function applyExternalCandidateRegistration(
  performedBy: { id: string; role: UserRole },
  input: ExternalCandidateRegistrationInput,
) {
  if (!["ADMIN", "EXAM_OFFICER"].includes(performedBy.role)) {
    throw new RegistrationError(
      "Only Admin or Exam Officer can register external candidates",
      403,
    );
  }

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
      billingScope: "EXTERNAL_BILLING",
      registrationType: "EXTERNAL",
      auditAction: RegistrationAuditAction.EXTERNAL_REGISTRATION_CREATED,
      sessionAuditAction: RegistrationAuditAction.ADD,
      recordWorkspaceAudit: true,
      registrationSource: "EXTERNAL_CANDIDATE",
      lockImmediately: true,
      requireInternal: false,
      requireReason: true,
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

/**
 * EO/Admin helps an internal student after student self-registration closes.
 * - While the window is OPEN: assisted registration (fee stage applies at submission time).
 * - After the window is CLOSED: post-lock adjustment on the normal workspace.
 */
export async function applyStaffStudentRegistrationAfterStudentClose(
  performedBy: { id: string; role: UserRole },
  input: StaffRegistrationInput,
) {
  if (!["ADMIN", "EXAM_OFFICER"].includes(performedBy.role)) {
    throw new RegistrationError("Only Admin or Exam Officer can help students after the deadline", 403);
  }

  const reason = input.reason?.trim();
  if (!reason) throw new RegistrationError("Reason is required", 400);

  const window = await prisma.registrationWindow.findUnique({
    where: { id: input.registrationWindowId },
  });
  if (!window) throw new RegistrationError("Registration window not found", 404);

  const now = new Date();
  if (!isStudentRegistrationPeriodClosed(window, now)) {
    throw new RegistrationError(
      "Student self-registration is still open. Use assisted registration instead.",
      400,
    );
  }

  const uniqueSessionIds = [...new Set(input.examSessionIds)];
  if (uniqueSessionIds.length === 0) {
    throw new RegistrationError("At least one exam session must be selected", 400);
  }

  if (window.status === "OPEN" && isRegistrationWindowOpenForStaff(window, now)) {
    return applyAssistedRegistration(performedBy, { ...input, examSessionIds: uniqueSessionIds, reason });
  }

  if (window.status === "CLOSED" || window.status === "ARCHIVED") {
    if (!window.postLockAdjustmentEnabled) {
      throw new RegistrationError("Post-lock adjustment is disabled for this registration window", 400);
    }

    const candidate = await resolveInternalCandidate(input);
    const studentId = candidate.userId ?? null;
    const workspace = await ensureRegistrationWorkspaceForCandidate(
      candidate.id,
      window.id,
      studentId,
      "INTERNAL_NORMAL",
    );

    await applyLockedRegistrationAdjustment(
      workspace.id,
      performedBy,
      {
        reason,
        addExamSessionIds: uniqueSessionIds,
        teacherRequestedBy: input.teacherRequestedBy,
      },
    );

    return getRegistrationWorkspaceById(workspace.id);
  }

  throw new RegistrationError("Registration window is not available for staff registration", 400);
}

/** @deprecated Use applyStaffStudentRegistrationAfterStudentClose */
export async function applyLateRegistration(
  performedBy: { id: string; role: UserRole },
  input: StaffRegistrationInput,
) {
  return applyStaffStudentRegistrationAfterStudentClose(performedBy, input);
}
