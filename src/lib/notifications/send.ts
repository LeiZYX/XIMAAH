import type {
  StudentNotificationStatus,
  StudentNotificationType,
} from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getResolvedEmailSettings } from "@/lib/mail/email-settings";
import { isSmtpConfigured, sendMail } from "@/lib/mail/smtp";

export interface NotificationRecipient {
  studentUserId: string | null;
  email: string | null;
  name: string;
}

export async function resolveStudentRecipient(params: {
  studentUserId?: string | null;
  candidateId?: string | null;
  emailSnapshot?: string | null;
  nameSnapshot?: string | null;
}): Promise<NotificationRecipient> {
  let studentUserId = params.studentUserId ?? null;
  let email = params.emailSnapshot?.trim() || null;
  let name = params.nameSnapshot?.trim() || "Student";

  if (studentUserId) {
    const user = await prisma.user.findUnique({
      where: { id: studentUserId },
      select: {
        id: true,
        name: true,
        email: true,
        studentProfile: { select: { email: true } },
      },
    });
    if (user) {
      email = user.email?.trim() || user.studentProfile?.email?.trim() || email;
      name = user.name || name;
    }
  } else if (params.candidateId) {
    const candidate = await prisma.candidate.findUnique({
      where: { id: params.candidateId },
      select: {
        englishName: true,
        email: true,
        userId: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            studentProfile: { select: { email: true } },
          },
        },
      },
    });
    if (candidate?.user) {
      studentUserId = candidate.user.id;
      email =
        candidate.user.email?.trim() ||
        candidate.user.studentProfile?.email?.trim() ||
        candidate.email?.trim() ||
        email;
      name = candidate.user.name || candidate.englishName || name;
    } else if (candidate) {
      email = candidate.email?.trim() || email;
      name = candidate.englishName || name;
    }
  }

  return { studentUserId, email, name };
}

export async function alreadyDelivered(dedupeKey: string): Promise<boolean> {
  const existing = await prisma.studentNotificationLog.findUnique({
    where: { dedupeKey },
    select: { status: true },
  });
  return existing?.status === "SENT" || existing?.status === "SKIPPED";
}

export async function recordNotification(params: {
  type: StudentNotificationType;
  status: StudentNotificationStatus;
  dedupeKey: string;
  studentUserId?: string | null;
  recipientEmail?: string | null;
  registrationWindowId?: string | null;
  feeStatementId?: string | null;
  subject?: string | null;
  error?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const metadata =
    params.metadata === undefined
      ? undefined
      : (params.metadata as Prisma.InputJsonValue);

  const data = {
    type: params.type,
    status: params.status,
    studentUserId: params.studentUserId ?? null,
    recipientEmail: params.recipientEmail ?? null,
    registrationWindowId: params.registrationWindowId ?? null,
    feeStatementId: params.feeStatementId ?? null,
    subject: params.subject ?? null,
    error: params.error ?? null,
    metadata,
    sentAt: params.status === "SENT" ? new Date() : null,
  };

  await prisma.studentNotificationLog.upsert({
    where: { dedupeKey: params.dedupeKey },
    create: {
      dedupeKey: params.dedupeKey,
      ...data,
    },
    update: data,
  });
}

export async function deliverStudentNotification(params: {
  type: StudentNotificationType;
  dedupeKey: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  studentUserId?: string | null;
  registrationWindowId?: string | null;
  feeStatementId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<{ delivered: boolean; skipped?: boolean; reason?: string }> {
  if (await alreadyDelivered(params.dedupeKey)) {
    return { delivered: false, skipped: true, reason: "already delivered" };
  }

  if (!(await isSmtpConfigured())) {
    await recordNotification({
      type: params.type,
      status: "SKIPPED",
      dedupeKey: params.dedupeKey,
      studentUserId: params.studentUserId,
      recipientEmail: params.to,
      registrationWindowId: params.registrationWindowId,
      feeStatementId: params.feeStatementId,
      subject: params.subject,
      error: "SMTP not configured",
      metadata: params.metadata,
    });
    return { delivered: false, skipped: true, reason: "SMTP not configured" };
  }

  try {
    const result = await sendMail({
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });

    if (!result.sent) {
      await recordNotification({
        type: params.type,
        status: "SKIPPED",
        dedupeKey: params.dedupeKey,
        studentUserId: params.studentUserId,
        recipientEmail: params.to,
        registrationWindowId: params.registrationWindowId,
        feeStatementId: params.feeStatementId,
        subject: params.subject,
        error: result.reason,
        metadata: params.metadata,
      });
      return { delivered: false, skipped: true, reason: result.reason };
    }

    await recordNotification({
      type: params.type,
      status: "SENT",
      dedupeKey: params.dedupeKey,
      studentUserId: params.studentUserId,
      recipientEmail: params.to,
      registrationWindowId: params.registrationWindowId,
      feeStatementId: params.feeStatementId,
      subject: params.subject,
      metadata: params.metadata,
    });
    return { delivered: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "SMTP send failed";
    await recordNotification({
      type: params.type,
      status: "FAILED",
      dedupeKey: params.dedupeKey,
      studentUserId: params.studentUserId,
      recipientEmail: params.to,
      registrationWindowId: params.registrationWindowId,
      feeStatementId: params.feeStatementId,
      subject: params.subject,
      error: message,
      metadata: params.metadata,
    });
    console.error(`[student-notification] ${params.type} failed:`, message);
    return { delivered: false, reason: message };
  }
}

export async function getAppUrl(): Promise<string> {
  const settings = await getResolvedEmailSettings();
  return settings.appUrl || "http://localhost:3000";
}

/** Fire-and-forget wrapper so business flows are never blocked by email. */
export function queueStudentNotification(task: () => Promise<unknown>): void {
  void task().catch((error) => {
    console.error("[student-notification] background task failed:", error);
  });
}
