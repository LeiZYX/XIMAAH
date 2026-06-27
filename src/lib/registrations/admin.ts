import { RegistrationAuditAction, RegistrationStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import {
  createRegistrationAuditLog,
  registrationAuditSnapshot,
} from "@/lib/registrations/audit";
import { canRegisterInWindow } from "@/lib/registrations/window";
import { RegistrationError } from "@/lib/registrations/errors";
import { registrationInclude } from "@/lib/registrations/service";

export async function adminAdjustRegistration(
  performedById: string,
  registrationId: string,
  updates: {
    status?: RegistrationStatus;
    studentNameSnapshot?: string;
    studentNoSnapshot?: string;
    gradeSnapshot?: string;
    classNameSnapshot?: string;
    emailSnapshot?: string | null;
    phoneSnapshot?: string | null;
  },
  note?: string,
) {
  const registration = await prisma.studentExamRegistration.findUnique({
    where: { id: registrationId },
  });

  if (!registration) {
    throw new RegistrationError("Registration not found", 404);
  }

  const before = registrationAuditSnapshot(registration);
  const data = {
    ...updates,
    ...(updates.status === RegistrationStatus.CANCELLED
      ? { cancelledAt: new Date(), lockedAt: null }
      : {}),
    ...(updates.status === RegistrationStatus.LOCKED
      ? { lockedAt: new Date(), cancelledAt: null }
      : {}),
    ...(updates.status === RegistrationStatus.ACTIVE
      ? { cancelledAt: null, lockedAt: null }
      : {}),
  };

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.studentExamRegistration.update({
      where: { id: registrationId },
      data,
      include: registrationInclude,
    });

    await createRegistrationAuditLog(
      {
        studentId: row.studentId,
        registrationId: row.id,
        examSessionId: row.examSessionId,
        action: RegistrationAuditAction.ADMIN_ADJUST,
        performedById,
        beforeValue: before,
        afterValue: registrationAuditSnapshot(row),
        note,
      },
      tx,
    );

    return row;
  });

  return updated;
}

export async function adminCancelRegistration(
  performedById: string,
  registrationId: string,
  note?: string,
) {
  return adminAdjustRegistration(
    performedById,
    registrationId,
    { status: RegistrationStatus.CANCELLED },
    note ?? "Cancelled by admin",
  );
}

export async function adminReactivateRegistration(
  performedById: string,
  registrationId: string,
  note?: string,
) {
  const registration = await prisma.studentExamRegistration.findUnique({
    where: { id: registrationId },
    include: { registrationWindow: true },
  });

  if (!registration) {
    throw new RegistrationError("Registration not found", 404);
  }

  if (!canRegisterInWindow(registration.registrationWindow)) {
    throw new RegistrationError("Registration window is not open", 400);
  }

  return adminAdjustRegistration(
    performedById,
    registrationId,
    { status: RegistrationStatus.ACTIVE },
    note ?? "Reactivated by admin",
  );
}
