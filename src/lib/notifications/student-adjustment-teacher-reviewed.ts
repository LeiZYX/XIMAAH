import { UserRole } from "@/generated/prisma/enums";
import { getResolvedEmailSettings } from "@/lib/mail/email-settings";
import {
  listHomeroomTeachersForGrade,
  resolveTeacherEmail,
} from "@/lib/homeroom/class-homeroom";
import { escapeHtml, renderEmailLayout } from "@/lib/notifications/layout";
import {
  deliverStudentNotification,
  queueStudentNotification,
  resolveStudentRecipient,
} from "@/lib/notifications/send";
import { studentRegistrationsUrl } from "@/lib/notifications/templates";
import { prisma } from "@/lib/prisma";

function uniqueEmails(emails: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of emails) {
    const email = raw?.trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    out.push(raw!.trim());
  }
  return out;
}

async function resolveExamOfficerEmails(registrationWindowId: string): Promise<string[]> {
  const [officers, window] = await Promise.all([
    prisma.user.findMany({
      where: { role: UserRole.EXAM_OFFICER, isActive: true },
      select: { email: true },
    }),
    prisma.registrationWindow.findUnique({
      where: { id: registrationWindowId },
      select: {
        examBoard: { select: { defaultExamOfficerEmail: true } },
      },
    }),
  ]);

  return uniqueEmails([
    ...officers.map((row) => row.email),
    window?.examBoard.defaultExamOfficerEmail,
  ]);
}

export function renderStudentAdjustmentTeacherReviewEmail(params: {
  appUrl: string;
  studentName: string;
  decision: "APPROVED" | "REJECTED";
  reviewerName: string;
  reviewReason: string;
  windowTitle: string;
  gradeLabel: string;
  className: string;
  isProxyReview: boolean;
  primaryHomeroomName: string | null;
}): { subject: string; text: string; html: string } {
  const approved = params.decision === "APPROVED";
  const subject = approved
    ? `${params.windowTitle} — Late adjustment approved by teacher`
    : `${params.windowTitle} — Late adjustment rejected by teacher`;

  const nextStep = approved
    ? "Your request now awaits Exams Office approval before any change is applied."
    : "No changes were applied. If the request deadline has not passed, you may submit a new request.";

  const proxyNote =
    params.isProxyReview && params.primaryHomeroomName
      ? `Reviewed by ${params.reviewerName} on behalf of form teacher ${params.primaryHomeroomName}.`
      : `Reviewed by ${params.reviewerName}.`;

  const text = [
    `Hello ${params.studentName},`,
    "",
    `Your late exam adjustment request for ${params.windowTitle} (${params.gradeLabel} ${params.className}) has been ${approved ? "approved" : "rejected"} by a form teacher.`,
    "",
    proxyNote,
    `Reason: ${params.reviewReason}`,
    "",
    nextStep,
    "",
    `View your registrations: ${studentRegistrationsUrl(params.appUrl)}`,
    "",
    "This is an automated message from XIMA Assessment Hub.",
  ].join("\n");

  const bodyHtml = `
    <p>Hello ${escapeHtml(params.studentName)},</p>
    <p>Your late exam adjustment request for <strong>${escapeHtml(params.windowTitle)}</strong>
      (${escapeHtml(params.gradeLabel)} ${escapeHtml(params.className)}) has been
      <strong>${approved ? "approved" : "rejected"}</strong> by a form teacher.</p>
    <p>${escapeHtml(proxyNote)}</p>
    <p><strong>Reason:</strong> ${escapeHtml(params.reviewReason)}</p>
    <p>${escapeHtml(nextStep)}</p>
    <p><a href="${escapeHtml(studentRegistrationsUrl(params.appUrl))}">View your registrations</a></p>
  `;

  return {
    subject,
    text,
    html: renderEmailLayout({
      title: subject,
      bodyHtml,
    }),
  };
}

export async function notifyStudentAdjustmentTeacherReviewed(requestId: string) {
  const settings = await getResolvedEmailSettings();
  if (!settings.notifyStaffStudentAdjustment) {
    return { delivered: false, skipped: true, reason: "Staff student-adjustment emails disabled" };
  }

  const request = await prisma.studentAdjustmentRequest.findUnique({
    where: { id: requestId },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          email: true,
          studentProfile: { select: { email: true } },
        },
      },
      teacherReviewedBy: { select: { id: true, name: true } },
      primaryHomeroomTeacher: { select: { id: true, name: true } },
      registrationWindow: { select: { id: true, title: true } },
    },
  });

  if (!request || !request.teacherReviewedBy || !request.teacherReviewedAt) {
    return { delivered: false, skipped: true, reason: "Request not teacher-reviewed" };
  }

  if (
    request.status !== "PENDING_EO" &&
    !(request.status === "REJECTED" && request.rejectedAtStage === "TEACHER")
  ) {
    return { delivered: false, skipped: true, reason: "Unexpected status after teacher review" };
  }

  const decision = request.status === "PENDING_EO" ? "APPROVED" : "REJECTED";
  const recipient = await resolveStudentRecipient({
    studentUserId: request.studentId,
    emailSnapshot: request.student.email ?? request.student.studentProfile?.email,
    nameSnapshot: request.student.name,
  });

  if (!recipient.email) {
    return { delivered: false, skipped: true, reason: "No student email address" };
  }

  const grade = request.studentGradeSnapshot;
  const sameGradeTeachers = grade ? await listHomeroomTeachersForGrade(grade) : [];
  const gradeTeacherEmails = sameGradeTeachers
    .filter((row) => row.teacherUserId !== request.teacherReviewedByUserId)
    .map((row) => resolveTeacherEmail(row.teacher));

  const eoEmails = await resolveExamOfficerEmails(request.registrationWindowId);
  const cc = uniqueEmails([...gradeTeacherEmails, ...eoEmails]).filter(
    (email) => email.toLowerCase() !== recipient.email!.toLowerCase(),
  );

  const gradeLabel = request.studentGradeSnapshot?.replace(/^G/, "G") ?? "—";
  const content = renderStudentAdjustmentTeacherReviewEmail({
    appUrl: settings.appUrl,
    studentName: recipient.name,
    decision,
    reviewerName: request.teacherReviewedBy.name,
    reviewReason: request.teacherReviewReason?.trim() || "—",
    windowTitle: request.registrationWindow.title,
    gradeLabel,
    className: request.studentClassNameSnapshot ?? "—",
    isProxyReview:
      Boolean(request.primaryHomeroomTeacherId) &&
      request.primaryHomeroomTeacherId !== request.teacherReviewedByUserId,
    primaryHomeroomName: request.primaryHomeroomTeacher?.name ?? null,
  });

  return deliverStudentNotification({
    type: "STUDENT_ADJUSTMENT_TEACHER_REVIEWED",
    dedupeKey: `STUDENT_ADJUSTMENT_TEACHER_REVIEWED:${requestId}:${decision}`,
    to: recipient.email,
    cc,
    subject: content.subject,
    text: content.text,
    html: content.html,
    studentUserId: recipient.studentUserId,
    registrationWindowId: request.registrationWindowId,
    metadata: {
      requestId,
      decision,
      reviewerUserId: request.teacherReviewedByUserId,
      cc,
    },
  });
}

export function queueStudentAdjustmentTeacherReviewedNotification(requestId: string) {
  queueStudentNotification(() => notifyStudentAdjustmentTeacherReviewed(requestId));
}
