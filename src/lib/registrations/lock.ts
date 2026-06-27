import type { RegistrationWindowStatus } from "@/generated/prisma/enums";
import { RegistrationAuditAction, RegistrationStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import {
  createRegistrationAuditLog,
  registrationAuditSnapshot,
} from "@/lib/registrations/audit";
import { canRegisterInWindow } from "@/lib/registrations/window";
import { hasWorkspaceSchema } from "@/lib/registrations/schema-capabilities";
import { RegistrationError } from "@/lib/registrations/errors";

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

export async function lockRegistrationsForWindow(windowId: string, performedById?: string) {
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
        const workspace = await tx.registrationWorkspace.upsert({
          where: {
            studentId_registrationWindowId: {
              studentId: registration.studentId,
              registrationWindowId: windowId,
            },
          },
          create: {
            studentId: registration.studentId,
            registrationWindowId: windowId,
            lockedAt: now,
          },
          update: { lockedAt: now },
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
          studentId: registration.studentId,
          registrationId: registration.id,
          examSessionId: registration.examSessionId,
          action: workspaceReady
            ? RegistrationAuditAction.SYSTEM_LOCK
            : RegistrationAuditAction.LOCK,
          performedById: performerId,
          performedByRole: workspaceReady ? "ADMIN" : undefined,
          beforeValue: registrationAuditSnapshot(registration),
          afterValue: registrationAuditSnapshot(updated),
          note: "Registration window closed",
        },
        tx,
      );
    });
  }

  return actives.length;
}

export async function ensureExpiredWindowsLocked() {
  const now = new Date();

  const windows = await prisma.registrationWindow.findMany({
    where: {
      OR: [{ status: "CLOSED" }, { status: "OPEN", endAt: { lt: now } }],
    },
  });

  let lockedCount = 0;

  for (const window of windows) {
    if (window.status === "OPEN" && window.endAt < now) {
      await prisma.registrationWindow.update({
        where: { id: window.id },
        data: { status: "CLOSED" },
      });
    }

    lockedCount += await lockRegistrationsForWindow(window.id);
  }

  return lockedCount;
}

export function isStudentEditableRegistration(
  registration: { status: string },
  window: { status: RegistrationWindowStatus; startAt: Date; endAt: Date },
  now = new Date(),
): boolean {
  return (
    registration.status === RegistrationStatus.ACTIVE &&
    canRegisterInWindow(window, now)
  );
}
