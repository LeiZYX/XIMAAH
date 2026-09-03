import { STUDENT_VISIBLE } from "@/lib/registrations/metadata";
import { prisma } from "@/lib/prisma";
import {
  boardSeriesLabel,
  renderExamListEmail,
  type ExamRowForEmail,
} from "@/lib/notifications/templates";
import {
  deliverStudentNotification,
  getAppUrl,
  queueStudentNotification,
  recordNotification,
  resolveStudentRecipient,
} from "@/lib/notifications/send";

function groupKey(params: {
  studentId: string | null;
  candidateId: string | null;
  email: string | null;
}): string {
  if (params.studentId) return `user:${params.studentId}`;
  if (params.candidateId) return `candidate:${params.candidateId}`;
  if (params.email) return `email:${params.email.toLowerCase()}`;
  return "unknown";
}

/**
 * Email internal students whose registrations were locked in this window.
 * When `options` is provided, only those students are notified (the ones
 * locked in the current lock pass) — avoids mass-mailing historical locks.
 */
export async function notifyRegistrationLockedForWindow(
  windowId: string,
  options?: {
    studentUserIds?: string[];
    candidateIds?: string[];
  },
): Promise<{
  attempted: number;
  delivered: number;
  skipped: number;
}> {
  const window = await prisma.registrationWindow.findUnique({
    where: { id: windowId },
    select: {
      id: true,
      title: true,
      examBoard: { select: { code: true, name: true } },
      examSeries: { select: { name: true, year: true } },
    },
  });

  if (!window) {
    return { attempted: 0, delivered: 0, skipped: 0 };
  }

  const studentUserIds = [...new Set((options?.studentUserIds ?? []).filter(Boolean))];
  const candidateIds = [...new Set((options?.candidateIds ?? []).filter(Boolean))];

  if (options && studentUserIds.length === 0 && candidateIds.length === 0) {
    return { attempted: 0, delivered: 0, skipped: 0 };
  }

  const registrations = await prisma.studentExamRegistration.findMany({
    where: {
      registrationWindowId: windowId,
      status: "LOCKED",
      registrationType: "INTERNAL_NORMAL",
      visibleToStudent: true,
      visibleInStudentPortal: true,
      visibility: { in: [...STUDENT_VISIBLE] },
      ...(options
        ? {
            OR: [
              ...(studentUserIds.length > 0
                ? [
                    { studentId: { in: studentUserIds } },
                    { candidate: { userId: { in: studentUserIds } } },
                  ]
                : []),
              ...(candidateIds.length > 0
                ? [{ candidateId: { in: candidateIds } }]
                : []),
            ],
          }
        : {}),
    },
    include: {
      subject: { select: { code: true, name: true } },
      paper: { select: { code: true, title: true } },
      examSession: {
        select: { date: true, startTime: true, endTime: true, venue: true },
      },
      registrationWorkspace: { select: { confirmationNumber: true } },
      candidate: { select: { id: true, userId: true, email: true, englishName: true } },
      student: {
        select: {
          id: true,
          name: true,
          email: true,
          studentProfile: { select: { email: true } },
        },
      },
    },
    orderBy: [{ examSession: { date: "asc" } }, { paper: { code: "asc" } }],
  });

  if (registrations.length === 0) {
    return { attempted: 0, delivered: 0, skipped: 0 };
  }

  const groups = new Map<
    string,
    {
      studentId: string | null;
      candidateId: string | null;
      emailSnapshot: string | null;
      nameSnapshot: string;
      confirmationNumber: string | null;
      exams: ExamRowForEmail[];
    }
  >();

  for (const registration of registrations) {
    const studentId =
      registration.studentId ?? registration.candidate?.userId ?? null;
    const candidateId = registration.candidateId ?? registration.candidate?.id ?? null;
    const key = groupKey({
      studentId,
      candidateId,
      email: registration.emailSnapshot,
    });
    if (key === "unknown") continue;

    if (options) {
      const matchesStudent =
        studentId != null && studentUserIds.includes(studentId);
      const matchesCandidate =
        candidateId != null && candidateIds.includes(candidateId);
      if (!matchesStudent && !matchesCandidate) continue;
    }

    const existing = groups.get(key);
    const exam: ExamRowForEmail = {
      subjectCode: registration.subject.code,
      subjectName: registration.subject.name,
      paperCode: registration.paper.code,
      paperTitle: registration.paper.title,
      examDate: registration.examSession.date,
      startTime: registration.examSession.startTime,
      endTime: registration.examSession.endTime,
      venue: registration.examSession.venue,
    };

    if (existing) {
      existing.exams.push(exam);
      if (!existing.confirmationNumber) {
        existing.confirmationNumber =
          registration.registrationWorkspace?.confirmationNumber ?? null;
      }
    } else {
      groups.set(key, {
        studentId,
        candidateId,
        emailSnapshot: registration.emailSnapshot,
        nameSnapshot: registration.studentNameSnapshot,
        confirmationNumber:
          registration.registrationWorkspace?.confirmationNumber ?? null,
        exams: [exam],
      });
    }
  }

  const appUrl = await getAppUrl();
  const boardSeries = boardSeriesLabel({
    boardCode: window.examBoard.code,
    boardName: window.examBoard.name,
    seriesName: window.examSeries.name,
    seriesYear: window.examSeries.year,
  });

  let delivered = 0;
  let skipped = 0;

  for (const [key, group] of groups) {
    const recipient = await resolveStudentRecipient({
      studentUserId: group.studentId,
      candidateId: group.candidateId,
      emailSnapshot: group.emailSnapshot,
      nameSnapshot: group.nameSnapshot,
    });

    const dedupeKey = `REG_LOCKED:${windowId}:${key}`;

    if (!recipient.email) {
      await recordNotification({
        type: "REG_LOCKED",
        status: "SKIPPED",
        dedupeKey,
        studentUserId: recipient.studentUserId,
        registrationWindowId: windowId,
        error: "No student email address",
        metadata: { groupKey: key, examCount: group.exams.length },
      });
      skipped += 1;
      continue;
    }

    const content = renderExamListEmail({
      appUrl,
      studentName: recipient.name,
      boardSeries,
      confirmationNumber: group.confirmationNumber,
      intro: `Your exam registrations for ${boardSeries} (${window.title}) have been locked. Below is the list of exams currently on your registration.`,
      exams: group.exams,
    });

    const result = await deliverStudentNotification({
      type: "REG_LOCKED",
      dedupeKey,
      to: recipient.email,
      subject: content.subject,
      text: content.text,
      html: content.html,
      studentUserId: recipient.studentUserId,
      registrationWindowId: windowId,
      metadata: {
        groupKey: key,
        examCount: group.exams.length,
        confirmationNumber: group.confirmationNumber,
      },
    });

    if (result.delivered) delivered += 1;
    else skipped += 1;
  }

  return { attempted: groups.size, delivered, skipped };
}

export function queueRegistrationLockedNotifications(
  windowId: string,
  options?: {
    studentUserIds?: string[];
    candidateIds?: string[];
  },
): void {
  queueStudentNotification(() => notifyRegistrationLockedForWindow(windowId, options));
}
