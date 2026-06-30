import type { RegistrationWindowStatus } from "@/generated/prisma/enums";
import { RegistrationAuditAction, RegistrationStatus } from "@/generated/prisma/enums";
import type { RegistrationType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import {
  createRegistrationAuditLog,
  registrationAuditSnapshot,
} from "@/lib/registrations/audit";
import {
  canStudentEditRegistrationList,
  isRegistrationWindowOpenForStaff,
  isStudentRegistrationPeriodClosed,
} from "@/lib/registrations/window";
import { hasWorkspaceSchema } from "@/lib/registrations/schema-capabilities";
import { RegistrationError } from "@/lib/registrations/errors";
import { ensureRegistrationWorkspaceForCandidate } from "@/lib/registrations/workspace";
import { generateConfirmationNumber } from "@/lib/registrations/numbering";

async function resolveLockPerformer(windowId: string): Promise<string> {
  const window = await prisma.registrationWindow.findUnique({
    where: { id: windowId },
    select: { createdById: true },
  });
  if (window?.createdById) return window.createdById;

  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true },
  });
  if (admin) return admin.id;

  throw new RegistrationError("Cannot resolve audit performer for lock operation", 500);
}

export async function lockRegistrationsForWindow(
  windowId: string,
  performedById?: string,
  note = "Registration window closed",
  auditAction: RegistrationAuditAction = RegistrationAuditAction.SYSTEM_LOCK,
) {
  const performerId = performedById ?? (await resolveLockPerformer(windowId));
  const actives = await prisma.studentExamRegistration.findMany({
    where: {
      registrationWindowId: windowId,
      status: RegistrationStatus.ACTIVE,
    },
  });

  if (actives.length === 0) return 0;

  const now = new Date();

  for (const registration of actives) {
    await prisma.$transaction(async (tx) => {
      const workspaceReady = await hasWorkspaceSchema();
      let workspaceId: string | null = null;

      if (workspaceReady) {
        const registrationType: RegistrationType = registration.registrationType ?? "INTERNAL_NORMAL";
        if (!registration.candidateId) {
          throw new RegistrationError("Registration missing candidate", 500);
        }

        const workspace = await ensureRegistrationWorkspaceForCandidate(
          registration.candidateId,
          windowId,
          registration.studentId,
          registrationType,
          tx,
        );
        const confirmationNumber =
          workspace.confirmationNumber ??
          (await generateConfirmationNumber(registrationType, now.getFullYear(), tx));
        await tx.registrationWorkspace.update({
          where: { id: workspace.id },
          data: { lockedAt: now, confirmationNumber },
        });
        workspaceId = workspace.id;
      }

      const updated = await tx.studentExamRegistration.update({
        where: { id: registration.id },
        data: {
          status: RegistrationStatus.LOCKED,
          lockedAt: now,
          ...(workspaceId ? { registrationWorkspaceId: workspaceId } : {}),
        },
      });

      await createRegistrationAuditLog(
        {
          registrationWorkspaceId: workspaceId,
          registrationWindowId: windowId,
          candidateId: registration.candidateId,
          studentId: registration.studentId,
          registrationId: registration.id,
          examSessionId: registration.examSessionId,
          action: workspaceReady ? auditAction : RegistrationAuditAction.LOCK,
          performedById: performerId,
          performedByRole: workspaceReady ? "ADMIN" : undefined,
          assessmentHubCandidateNumberSnapshot:
            registration.assessmentHubCandidateNumberSnapshot,
          candidateTypeSnapshot: registration.candidateTypeSnapshot,
          beforeValue: registrationAuditSnapshot(registration),
          afterValue: registrationAuditSnapshot(updated),
          note,
        },
        tx,
      );
    });
  }

  return actives.length;
}

/** Lock student lists once student self-registration closes. */
export async function ensurePostStudentRegistrationCloseLocks(now = new Date()) {
  const windows = await prisma.registrationWindow.findMany({
    where: { status: "OPEN" },
  });

  let lockedCount = 0;
  for (const window of windows) {
    if (!isStudentRegistrationPeriodClosed(window, now)) continue;
    if (now <= window.studentRegistrationCloseAt) continue;
    lockedCount += await lockRegistrationsForWindow(
      window.id,
      undefined,
      "Student registration closed — student registration list locked",
      RegistrationAuditAction.STUDENT_REGISTRATION_CLOSED,
    );
  }
  return lockedCount;
}

/** @deprecated Use ensurePostStudentRegistrationCloseLocks */
export const ensurePostNormalEntryLocks = ensurePostStudentRegistrationCloseLocks;

export async function ensureExpiredWindowsLocked() {
  const now = new Date();

  let lockedCount = await ensurePostStudentRegistrationCloseLocks(now);

  const windows = await prisma.registrationWindow.findMany({
    where: {
      OR: [{ status: "CLOSED" }, { status: "OPEN", registrationCloseAt: { lt: now } }],
    },
  });

  for (const window of windows) {
    if (window.status === "OPEN" && window.registrationCloseAt < now) {
      await prisma.registrationWindow.update({
        where: { id: window.id },
        data: { status: "CLOSED" },
      });

      await createRegistrationAuditLog({
        registrationWindowId: window.id,
        performedById: window.createdById ?? (await resolveLockPerformer(window.id)),
        performedByRole: "ADMIN",
        action: RegistrationAuditAction.REGISTRATION_WINDOW_CLOSED,
        examSessionId: "",
        note: "Registration window reached registration close time",
      });
    }

    lockedCount += await lockRegistrationsForWindow(
      window.id,
      undefined,
      "Registration window closed",
      RegistrationAuditAction.REGISTRATION_WINDOW_CLOSED,
    );
  }

  return lockedCount;
}

export function isStudentEditableRegistration(
  registration: { status: string },
  window: {
    status: RegistrationWindowStatus;
    studentRegistrationOpenAt: Date;
    studentRegistrationCloseAt: Date;
    registrationCloseAt: Date;
    studentSelfRegistrationEnabled?: boolean;
  },
  now = new Date(),
): boolean {
  return (
    registration.status === RegistrationStatus.ACTIVE &&
    canStudentEditRegistrationList(window, [], now)
  );
}

export function isStaffRegistrationAllowed(
  window: {
    status: RegistrationWindowStatus;
    studentRegistrationOpenAt: Date;
    studentRegistrationCloseAt: Date;
    registrationCloseAt: Date;
  },
  now = new Date(),
): boolean {
  return isRegistrationWindowOpenForStaff(window, now);
}
