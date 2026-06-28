import type { UserRole } from "@/generated/prisma/enums";
import {
  RegistrationAuditAction,
  RegistrationStatus,
} from "@/generated/prisma/enums";
import {
  candidateRegistrationSnapshots,
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
  ensureRegistrationWorkspace,
} from "@/lib/registrations/workspace";
import type { AdjustmentSummaryPayload } from "@/lib/registrations/workspace-display";
import { appendAdjustmentHistoryBatch } from "@/lib/registrations/adjustment-history";
import { markStatementsNeedReview, markSupersededStatements } from "@/lib/fees/statement";
import { assertStudentCanRegister } from "@/lib/students/archive";
import {
  postLockAuditActionForRole,
  postLockSourceForRole,
} from "@/lib/registrations/metadata";

export interface PostLockAdjustmentInput {
  reason: string;
  addExamSessionIds?: string[];
  removeRegistrationIds?: string[];
  replacements?: Array<{ registrationId: string; newExamSessionId: string }>;
  teacherRequestedBy?: { name: string; role: UserRole };
}

function auditActionForRole(
  role: UserRole,
  kind: "ADD" | "REMOVE" | "REPLACE",
): RegistrationAuditAction {
  const prefix = role === "EXAM_OFFICER" ? "EO" : "ADMIN";
  switch (kind) {
    case "ADD":
      return prefix === "EO"
        ? RegistrationAuditAction.EO_ADD_AFTER_LOCK
        : RegistrationAuditAction.ADMIN_ADD_AFTER_LOCK;
    case "REMOVE":
      return prefix === "EO"
        ? RegistrationAuditAction.EO_REMOVE_AFTER_LOCK
        : RegistrationAuditAction.ADMIN_REMOVE_AFTER_LOCK;
    case "REPLACE":
      return prefix === "EO"
        ? RegistrationAuditAction.EO_REPLACE_AFTER_LOCK
        : RegistrationAuditAction.ADMIN_REPLACE_AFTER_LOCK;
  }
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

export async function applyPostLockAdjustment(
  workspaceId: string,
  performedBy: { id: string; role: UserRole },
  input: PostLockAdjustmentInput,
) {
  if (!["ADMIN", "EXAM_OFFICER"].includes(performedBy.role)) {
    throw new RegistrationError("Only Admin or Exam Officer can adjust locked registrations", 403);
  }

  const reason = input.reason?.trim();
  if (!reason) {
    throw new RegistrationError("Adjustment reason is required", 400);
  }

  const workspace = await prisma.registrationWorkspace.findUnique({
    where: { id: workspaceId },
    include: {
      registrationWindow: true,
      lastAdjustedByUser: { select: { name: true } },
      registrations: {
        where: { status: { in: [RegistrationStatus.ACTIVE, RegistrationStatus.LOCKED] } },
        include: registrationInclude,
      },
    },
  });

  if (!workspace) {
    throw new RegistrationError("Registration workspace not found", 404);
  }

  const hasLockedRows = workspace.registrations.some(
    (row) => row.status === RegistrationStatus.LOCKED,
  );
  const windowClosed = workspace.registrationWindow.status === "CLOSED";

  if (!hasLockedRows && !windowClosed) {
    throw new RegistrationError("Adjustments are only allowed for locked registrations", 400);
  }

  const candidate = await resolveCandidateForRegistration({
    candidateId: workspace.candidateId ?? undefined,
    studentId: workspace.studentId ?? undefined,
  });
  const candidateSnaps = candidateRegistrationSnapshots(candidate);

  const addIds = input.addExamSessionIds ?? [];
  if (addIds.length > 0 && candidate.candidateType === "INTERNAL" && workspace.studentId) {
    await assertStudentCanRegister(workspace.studentId);
  }

  const removeIds = input.removeRegistrationIds ?? [];
  const replacements = input.replacements ?? [];

  if (addIds.length === 0 && removeIds.length === 0 && replacements.length === 0) {
    throw new RegistrationError("No changes to apply", 400);
  }

  const summary: AdjustmentSummaryPayload = { added: [], removed: [], replaced: [] };
  const now = new Date();
  const itemSource = postLockSourceForRole(performedBy.role);
  const inheritVisibility = workspace.visibility ?? "STUDENT_AND_TEACHER";
  const inheritBilling = workspace.billingScope ?? "NORMAL_BILLING";

  await prisma.$transaction(async (tx) => {
    for (const registrationId of removeIds) {
      const registration = workspace.registrations.find((row) => row.id === registrationId);
      if (!registration) {
        throw new RegistrationError(`Registration ${registrationId} not found in workspace`, 404);
      }

      const before = registrationAuditSnapshot(registration);
      const updated = await tx.studentExamRegistration.update({
        where: { id: registrationId },
        data: {
          status: RegistrationStatus.CANCELLED,
          cancelledAt: now,
        },
        include: registrationInclude,
      });

      summary.removed.push(examLine(updated.examSession));

      await createRegistrationAuditLog(
        {
          registrationWorkspaceId: workspaceId,
          candidateId: candidate.id,
          studentId: workspace.studentId,
          registrationId,
          examSessionId: registration.examSessionId,
          action: auditActionForRole(performedBy.role, "REMOVE"),
          performedById: performedBy.id,
          performedByRole: performedBy.role,
          reason,
          registrationSource: itemSource,
          visibility: inheritVisibility,
          billingScope: inheritBilling,
          assessmentHubCandidateNumberSnapshot: candidateSnaps.assessmentHubCandidateNumberSnapshot,
          candidateTypeSnapshot: candidateSnaps.candidateTypeSnapshot,
          beforeValue: before,
          afterValue: registrationAuditSnapshot(updated),
          note: "Removed after lock",
        },
        tx,
      );
    }

    for (const replacement of replacements) {
      const registration = workspace.registrations.find(
        (row) => row.id === replacement.registrationId,
      );
      if (!registration) {
        throw new RegistrationError(
          `Registration ${replacement.registrationId} not found in workspace`,
          404,
        );
      }

      const newSession = await tx.examSession.findUnique({
        where: { id: replacement.newExamSessionId },
        include: {
          paper: { include: { subject: { include: { qualification: true } } } },
          examSeries: true,
        },
      });
      if (!newSession) {
        throw new RegistrationError("Replacement exam session not found", 404);
      }

      const before = registrationAuditSnapshot(registration);
      const cancelled = await tx.studentExamRegistration.update({
        where: { id: registration.id },
        data: { status: RegistrationStatus.CANCELLED, cancelledAt: now },
        include: registrationInclude,
      });

      const created = await tx.studentExamRegistration.create({
        data: {
          candidateId: candidate.id,
          studentId: workspace.studentId,
          registrationWorkspaceId: workspaceId,
          examSessionId: newSession.id,
          registrationWindowId: workspace.registrationWindowId,
          examBoardId: newSession.paper.subject.qualification.examBoardId,
          examSeriesId: newSession.examSeriesId,
          subjectId: newSession.paper.subjectId,
          paperId: newSession.paper.id,
          ...candidateSnaps,
          status: RegistrationStatus.LOCKED,
          lockedAt: registration.lockedAt ?? now,
          registrationSource: itemSource,
          visibility: inheritVisibility,
          billingScope: inheritBilling,
          addedByUserId: performedBy.id,
          addedByRole: performedBy.role,
          addedAt: now,
          reason,
        },
        include: registrationInclude,
      });

      summary.replaced.push({
        from: examLine(cancelled.examSession),
        to: examLine(created.examSession),
      });

      await createRegistrationAuditLog(
        {
          registrationWorkspaceId: workspaceId,
          candidateId: candidate.id,
          studentId: workspace.studentId,
          registrationId: registration.id,
          examSessionId: registration.examSessionId,
          action: auditActionForRole(performedBy.role, "REPLACE"),
          performedById: performedBy.id,
          performedByRole: performedBy.role,
          reason,
          registrationSource: itemSource,
          visibility: inheritVisibility,
          billingScope: inheritBilling,
          assessmentHubCandidateNumberSnapshot: candidateSnaps.assessmentHubCandidateNumberSnapshot,
          candidateTypeSnapshot: candidateSnaps.candidateTypeSnapshot,
          beforeValue: before,
          afterValue: registrationAuditSnapshot(created),
          note: `Replaced with ${newSession.paper.code}`,
        },
        tx,
      );
    }

    for (const examSessionId of addIds) {
      const session = await tx.examSession.findUnique({
        where: { id: examSessionId },
        include: {
          paper: { include: { subject: { include: { qualification: true } } } },
          examSeries: true,
        },
      });
      if (!session) {
        throw new RegistrationError(`Exam session ${examSessionId} not found`, 404);
      }

      const existing = await tx.studentExamRegistration.findFirst({
        where: {
          examSessionId,
          OR: [
            { candidateId: candidate.id },
            ...(workspace.studentId ? [{ studentId: workspace.studentId }] : []),
          ],
        },
      });
      if (
        existing &&
        (existing.status === RegistrationStatus.ACTIVE ||
          existing.status === RegistrationStatus.LOCKED)
      ) {
        throw new RegistrationError(`Student already registered for session ${examSessionId}`, 409);
      }

      const itemMeta = {
        registrationSource: itemSource,
        visibility: inheritVisibility,
        billingScope: inheritBilling,
        addedByUserId: performedBy.id,
        addedByRole: performedBy.role,
        addedAt: now,
        reason,
      };

      const lockedAt = workspace.lockedAt ?? now;
      const row =
        existing?.status === RegistrationStatus.CANCELLED
          ? await tx.studentExamRegistration.update({
              where: { id: existing.id },
              data: {
                candidateId: candidate.id,
                registrationWorkspaceId: workspaceId,
                registrationWindowId: workspace.registrationWindowId,
                examBoardId: session.paper.subject.qualification.examBoardId,
                examSeriesId: session.examSeriesId,
                subjectId: session.paper.subjectId,
                paperId: session.paper.id,
                ...candidateSnaps,
                status: RegistrationStatus.LOCKED,
                lockedAt,
                cancelledAt: null,
                ...itemMeta,
              },
              include: registrationInclude,
            })
          : await tx.studentExamRegistration.create({
              data: {
                candidateId: candidate.id,
                studentId: workspace.studentId,
                registrationWorkspaceId: workspaceId,
                examSessionId,
                registrationWindowId: workspace.registrationWindowId,
                examBoardId: session.paper.subject.qualification.examBoardId,
                examSeriesId: session.examSeriesId,
                subjectId: session.paper.subjectId,
                paperId: session.paper.id,
                ...candidateSnaps,
                status: RegistrationStatus.LOCKED,
                lockedAt,
                ...itemMeta,
              },
              include: registrationInclude,
            });

      summary.added.push(examLine(row.examSession));

      await createRegistrationAuditLog(
        {
          registrationWorkspaceId: workspaceId,
          candidateId: candidate.id,
          studentId: workspace.studentId,
          registrationId: row.id,
          examSessionId,
          action: auditActionForRole(performedBy.role, "ADD"),
          performedById: performedBy.id,
          performedByRole: performedBy.role,
          reason,
          registrationSource: itemSource,
          visibility: inheritVisibility,
          billingScope: inheritBilling,
          assessmentHubCandidateNumberSnapshot: candidateSnaps.assessmentHubCandidateNumberSnapshot,
          candidateTypeSnapshot: candidateSnaps.candidateTypeSnapshot,
          afterValue: registrationAuditSnapshot(row),
          note: "Added after lock",
        },
        tx,
      );
    }

    const performer = await tx.user.findUnique({
      where: { id: performedBy.id },
      select: { name: true },
    });

    const summarySessionId =
      addIds[0] ??
      workspace.registrations.find((row) => removeIds.includes(row.id))?.examSessionId ??
      workspace.registrations[0]?.examSessionId;

    if (summarySessionId) {
      const summaryAuditAction = postLockAuditActionForRole(performedBy.role);
      await createRegistrationAuditLog(
        {
          registrationWorkspaceId: workspaceId,
          candidateId: candidate.id,
          studentId: workspace.studentId,
          examSessionId: summarySessionId,
          action: summaryAuditAction as RegistrationAuditAction,
          performedById: performedBy.id,
          performedByRole: performedBy.role,
          reason,
          registrationSource: itemSource,
          visibility: inheritVisibility,
          billingScope: inheritBilling,
          assessmentHubCandidateNumberSnapshot: candidateSnaps.assessmentHubCandidateNumberSnapshot,
          candidateTypeSnapshot: candidateSnaps.candidateTypeSnapshot,
          afterValue: summary,
          note: "Post-lock adjustment summary",
        },
        tx,
      );
    }

    await tx.registrationWorkspace.update({
      where: { id: workspaceId },
      data: {
        hasPostLockAdjustment: true,
        lastAdjustedByUserId: performedBy.id,
        lastAdjustedByRole: performedBy.role,
        lastAdjustedAt: now,
        lastAdjustmentReason: reason,
        lastAdjustmentSummary: appendAdjustmentHistoryBatch(
          workspace.lastAdjustmentSummary,
          {
            adjustedAt: now.toISOString(),
            adjustedByName: performer?.name ?? "",
            adjustedByRole: performedBy.role,
            reason,
            requestedByName: input.teacherRequestedBy?.name,
            requestedByRole: input.teacherRequestedBy?.role,
            ...summary,
          },
          {
            lastAdjustedAt: workspace.lastAdjustedAt,
            lastAdjustedByName: workspace.lastAdjustedByUser?.name,
            lastAdjustedByRole: workspace.lastAdjustedByRole,
            lastAdjustmentReason: workspace.lastAdjustmentReason,
          },
        ),
      },
    });
  });

  await markSupersededStatements(workspaceId);
  await markStatementsNeedReview(workspaceId);

  const { getRegistrationWorkspaceById } = await import("@/lib/registrations/workspace");
  return getRegistrationWorkspaceById(workspaceId);
}
