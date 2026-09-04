import { prisma } from "@/lib/prisma";

export type ExamSeriesDeleteBlocker = {
  label: string;
  count: number;
};

/**
 * Returns usage counts that should prevent deleting an exam series.
 * Callers should reject delete when the list is non-empty.
 */
export async function getExamSeriesDeleteBlockers(
  examSeriesId: string,
): Promise<ExamSeriesDeleteBlocker[]> {
  const [
    examSessions,
    registrationWindows,
    includedInWindows,
    keyDates,
    studentExamRegistrations,
    feeRules,
    feeSchedules,
    reviewWindows,
    reviewRequests,
    cashInRequests,
    accessToScriptRequests,
    certificateRequests,
    resources,
  ] = await Promise.all([
    prisma.examSession.count({ where: { examSeriesId } }),
    prisma.registrationWindow.count({ where: { examSeriesId } }),
    prisma.registrationWindowIncludedSeries.count({ where: { examSeriesId } }),
    prisma.keyDate.count({ where: { examSeriesId } }),
    prisma.studentExamRegistration.count({ where: { examSeriesId } }),
    prisma.feeRule.count({ where: { examSeriesId } }),
    prisma.feeSchedule.count({ where: { examSeriesId } }),
    prisma.reviewWindow.count({ where: { examSeriesId } }),
    prisma.reviewRequest.count({ where: { examSeriesId } }),
    prisma.cashInRequest.count({ where: { examSeriesId } }),
    prisma.accessToScriptRequest.count({ where: { examSeriesId } }),
    prisma.certificateRequest.count({ where: { examSeriesId } }),
    prisma.resource.count({ where: { examSeriesId } }),
  ]);

  const blockers: ExamSeriesDeleteBlocker[] = [
    { label: "exam session(s)", count: examSessions },
    { label: "registration window(s)", count: registrationWindows },
    { label: "registration window included session link(s)", count: includedInWindows },
    { label: "key date(s)", count: keyDates },
    { label: "student exam registration(s)", count: studentExamRegistrations },
    { label: "fee rule(s)", count: feeRules },
    { label: "fee schedule(s)", count: feeSchedules },
    { label: "review window(s)", count: reviewWindows },
    { label: "review request(s)", count: reviewRequests },
    { label: "cash-in request(s)", count: cashInRequests },
    { label: "access to script request(s)", count: accessToScriptRequests },
    { label: "certificate request(s)", count: certificateRequests },
    { label: "resource(s)", count: resources },
  ].filter((item) => item.count > 0);

  return blockers;
}

export function formatExamSeriesDeleteBlockedMessage(
  blockers: ExamSeriesDeleteBlocker[],
): string {
  const details = blockers.map((item) => `${item.count} ${item.label}`).join(", ");
  return `Cannot delete this exam series because it is still in use: ${details}. Remove or reassign those records first.`;
}
