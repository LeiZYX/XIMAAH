import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { logUserAudit } from "@/lib/users/audit";

export interface CandidateDeleteBlockers {
  canDelete: boolean;
  reasons: string[];
}

export async function getCandidateDeleteBlockers(
  candidateId: string,
): Promise<CandidateDeleteBlockers> {
  const reasons: string[] = [];

  const [
    workspaces,
    registrations,
    feeStatements,
    feeStatementItems,
    examIdentities,
    reviewRequests,
    cashInRequests,
    accessToScriptRequests,
    certificateRequests,
    registrationAuditLogs,
    postResultsAuditLogs,
    examDocumentAuditLogs,
    changeRequests,
  ] = await Promise.all([
    prisma.registrationWorkspace.count({ where: { candidateId } }),
    prisma.studentExamRegistration.count({ where: { candidateId } }),
    prisma.feeStatement.count({ where: { candidateId } }),
    prisma.feeStatementItem.count({
      where: { feeStatement: { candidateId } },
    }),
    prisma.candidateExamIdentity.count({ where: { candidateId } }),
    prisma.reviewRequest.count({ where: { candidateId } }),
    prisma.cashInRequest.count({ where: { candidateId } }),
    prisma.accessToScriptRequest.count({ where: { candidateId } }),
    prisma.certificateRequest.count({ where: { candidateId } }),
    prisma.registrationAuditLog.count({ where: { candidateId } }),
    prisma.postResultsAuditLog.count({ where: { candidateId } }),
    prisma.examDocumentAuditLog.count({ where: { candidateId } }),
    prisma.registrationChangeRequest.count({ where: { candidateId } }),
  ]);

  if (workspaces > 0) reasons.push(`${workspaces} registration workspace(s)`);
  if (registrations > 0) reasons.push(`${registrations} registration item(s)`);
  if (feeStatements > 0) reasons.push(`${feeStatements} fee statement(s)`);
  if (feeStatementItems > 0) reasons.push(`${feeStatementItems} fee statement line item(s)`);
  if (examIdentities > 0) reasons.push(`${examIdentities} exam board identit(ies)`);
  if (reviewRequests > 0) reasons.push(`${reviewRequests} review request(s)`);
  if (cashInRequests > 0) reasons.push(`${cashInRequests} cash-in request(s)`);
  if (accessToScriptRequests > 0) reasons.push(`${accessToScriptRequests} access-to-script request(s)`);
  if (certificateRequests > 0) reasons.push(`${certificateRequests} certificate request(s)`);
  if (registrationAuditLogs > 0) reasons.push(`${registrationAuditLogs} registration audit log(s)`);
  if (postResultsAuditLogs > 0) reasons.push(`${postResultsAuditLogs} post-results audit log(s)`);
  if (examDocumentAuditLogs > 0) reasons.push(`${examDocumentAuditLogs} exam document audit log(s)`);
  if (changeRequests > 0) reasons.push(`${changeRequests} registration change request(s)`);

  return { canDelete: reasons.length === 0, reasons };
}

function auditMetadata(
  candidate: {
    id: string;
    studentId: string;
    assessmentHubCandidateNumber: string;
    userId: string | null;
  },
  reason?: string,
): Prisma.InputJsonValue {
  return {
    candidateId: candidate.id,
    studentId: candidate.studentId,
    candidateNumber: candidate.assessmentHubCandidateNumber,
    userId: candidate.userId,
    reason: reason ?? null,
    timestamp: new Date().toISOString(),
  };
}

export async function archiveCandidate(
  candidateId: string,
  performedById: string,
  reason?: string,
) {
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    select: {
      id: true,
      studentId: true,
      assessmentHubCandidateNumber: true,
      userId: true,
      status: true,
    },
  });
  if (!candidate) throw new Error("Candidate not found");

  await prisma.$transaction(async (tx) => {
    await tx.candidate.update({
      where: { id: candidateId },
      data: { status: "INACTIVE", loginEnabled: false },
    });
    if (candidate.userId) {
      await tx.user.update({
        where: { id: candidate.userId },
        data: { isActive: false },
      });
      await tx.studentProfile.updateMany({
        where: { userId: candidate.userId },
        data: { status: "INACTIVE" },
      });
    }
  });

  await logUserAudit({
    action: "STUDENT_ARCHIVED",
    performedById,
    targetUserId: candidate.userId,
    metadata: auditMetadata(candidate, reason),
  });

  return candidate;
}

export async function reactivateCandidate(
  candidateId: string,
  performedById: string,
  reason?: string,
) {
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    select: {
      id: true,
      studentId: true,
      assessmentHubCandidateNumber: true,
      userId: true,
    },
  });
  if (!candidate) throw new Error("Candidate not found");

  await prisma.$transaction(async (tx) => {
    await tx.candidate.update({
      where: { id: candidateId },
      data: { status: "ACTIVE", loginEnabled: Boolean(candidate.userId) },
    });
    if (candidate.userId) {
      await tx.user.update({
        where: { id: candidate.userId },
        data: { isActive: true },
      });
      await tx.studentProfile.updateMany({
        where: { userId: candidate.userId },
        data: { status: "ACTIVE" },
      });
    }
  });

  await logUserAudit({
    action: "STUDENT_REACTIVATED",
    performedById,
    targetUserId: candidate.userId,
    metadata: auditMetadata(candidate, reason),
  });

  return candidate;
}

export async function deleteCandidate(
  candidateId: string,
  performedById: string,
  reason?: string,
) {
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    include: { user: { include: { studentProfile: true } } },
  });
  if (!candidate) throw new Error("Candidate not found");

  const blockers = await getCandidateDeleteBlockers(candidateId);
  if (!blockers.canDelete) {
    throw new Error(
      "This student has historical records and cannot be deleted. You may archive this student instead.",
    );
  }

  const metadata = auditMetadata(candidate, reason);
  const deletedUserId = candidate.userId;

  // targetUserId must be null — the user may be deleted in the same operation, and
  // metadata already records deletedUserId / studentId / candidateId for the audit trail.
  await logUserAudit({
    action: "STUDENT_DELETED",
    performedById,
    targetUserId: null,
    metadata,
  });

  await prisma.$transaction(async (tx) => {
    await tx.candidate.delete({ where: { id: candidateId } });
    if (deletedUserId && candidate.user) {
      await tx.user.delete({ where: { id: deletedUserId } });
    }
  });

  return { deleted: true, candidateId };
}
