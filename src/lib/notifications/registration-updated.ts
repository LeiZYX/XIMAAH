import { STUDENT_VISIBLE } from "@/lib/registrations/metadata";
import type { AdjustmentSummaryPayload } from "@/lib/registrations/workspace-display";
import { prisma } from "@/lib/prisma";
import {
  boardSeriesLabel,
  renderRegistrationUpdatedEmail,
  type ExamRowForEmail,
} from "@/lib/notifications/templates";
import {
  deliverStudentNotification,
  getAppUrl,
  queueStudentNotification,
  recordNotification,
  resolveStudentRecipient,
} from "@/lib/notifications/send";
import { isStudentNotificationEnabled } from "@/lib/notifications/policy";

export async function notifyRegistrationUpdated(params: {
  workspaceId: string;
  summary: AdjustmentSummaryPayload;
  reason: string;
  adjustedAtIso: string;
}): Promise<{ delivered: boolean; skipped?: boolean; reason?: string }> {
  const policy = await isStudentNotificationEnabled("REG_UPDATED");
  if (!policy.enabled) {
    return { delivered: false, skipped: true, reason: policy.reason };
  }

  const hasExamChanges =
    params.summary.added.length > 0 ||
    params.summary.removed.length > 0 ||
    params.summary.replaced.length > 0;
  if (!hasExamChanges) {
    return { delivered: false, skipped: true, reason: "No exam changes" };
  }

  const workspace = await prisma.registrationWorkspace.findUnique({
    where: { id: params.workspaceId },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          email: true,
          studentProfile: { select: { email: true } },
        },
      },
      candidate: { select: { id: true, userId: true, email: true, englishName: true } },
      registrationWindow: {
        include: {
          examBoard: { select: { code: true, name: true } },
          examSeries: { select: { name: true, year: true } },
        },
      },
      registrations: {
        where: {
          status: "LOCKED",
          registrationType: "INTERNAL_NORMAL",
          visibleToStudent: true,
          visibleInStudentPortal: true,
          visibility: { in: [...STUDENT_VISIBLE] },
        },
        include: {
          subject: { select: { code: true, name: true } },
          paper: { select: { code: true, title: true } },
          examSession: {
            select: { date: true, startTime: true, endTime: true, venue: true },
          },
        },
        orderBy: [{ examSession: { date: "asc" } }, { paper: { code: "asc" } }],
      },
    },
  });

  if (!workspace || workspace.registrationType !== "INTERNAL_NORMAL") {
    return { delivered: false, skipped: true, reason: "Not a notifiable workspace" };
  }

  const recipient = await resolveStudentRecipient({
    studentUserId: workspace.studentId,
    candidateId: workspace.candidateId,
    emailSnapshot:
      workspace.student?.email ??
      workspace.student?.studentProfile?.email ??
      workspace.candidate?.email ??
      null,
    nameSnapshot: workspace.student?.name ?? workspace.candidate?.englishName ?? null,
  });

  const dedupeKey = `REG_UPDATED:${params.workspaceId}:${params.adjustedAtIso}`;

  if (!recipient.email) {
    await recordNotification({
      type: "REG_UPDATED",
      status: "SKIPPED",
      dedupeKey,
      studentUserId: recipient.studentUserId,
      registrationWindowId: workspace.registrationWindowId,
      error: "No student email address",
      metadata: { workspaceId: params.workspaceId },
    });
    return { delivered: false, skipped: true, reason: "No student email address" };
  }

  const window = workspace.registrationWindow;
  const boardSeries = boardSeriesLabel({
    boardCode: window.examBoard.code,
    boardName: window.examBoard.name,
    seriesName: window.examSeries.name,
    seriesYear: window.examSeries.year,
  });

  const currentExams: ExamRowForEmail[] = workspace.registrations.map((registration) => ({
    subjectCode: registration.subject.code,
    subjectName: registration.subject.name,
    paperCode: registration.paper.code,
    paperTitle: registration.paper.title,
    examDate: registration.examSession.date,
    startTime: registration.examSession.startTime,
    endTime: registration.examSession.endTime,
    venue: registration.examSession.venue,
  }));

  const appUrl = await getAppUrl();
  const content = renderRegistrationUpdatedEmail({
    appUrl,
    studentName: recipient.name,
    boardSeries,
    confirmationNumber: workspace.confirmationNumber,
    reason: params.reason,
    added: params.summary.added,
    removed: params.summary.removed,
    replaced: params.summary.replaced,
    currentExams,
  });

  return deliverStudentNotification({
    type: "REG_UPDATED",
    dedupeKey,
    to: recipient.email,
    subject: content.subject,
    text: content.text,
    html: content.html,
    studentUserId: recipient.studentUserId,
    registrationWindowId: workspace.registrationWindowId,
    metadata: {
      workspaceId: params.workspaceId,
      added: params.summary.added.length,
      removed: params.summary.removed.length,
      replaced: params.summary.replaced.length,
    },
  });
}

export function queueRegistrationUpdatedNotification(params: {
  workspaceId: string;
  summary: AdjustmentSummaryPayload;
  reason: string;
  adjustedAtIso: string;
}): void {
  queueStudentNotification(() => notifyRegistrationUpdated(params));
}
