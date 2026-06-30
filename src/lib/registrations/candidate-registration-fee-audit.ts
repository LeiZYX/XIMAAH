import type { CandidateRegistrationFeeAuditInfo } from "@/components/registrations/CandidateRegistrationFeeSection";

export function findCandidateRegistrationFeeAuditInfo(
  auditLogs: Array<{
    action: string;
    performedAt: string;
    reason: string | null;
    performedBy: { name: string; role?: string | null };
    afterValue?: string | null;
  }>,
): CandidateRegistrationFeeAuditInfo | null {
  const latestAdd = [...auditLogs]
    .reverse()
    .find((log) => log.action === "CANDIDATE_REGISTRATION_FEE_ADDED");

  if (!latestAdd) return null;

  return {
    performedByName: latestAdd.performedBy.name,
    performedByRole: latestAdd.performedBy.role ?? "EXAM_OFFICER",
    performedAt: latestAdd.performedAt,
    reason: latestAdd.reason,
  };
}
