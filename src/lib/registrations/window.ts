import type { RegistrationWindowStatus } from "@/generated/prisma/enums";

export function isRegistrationWindowOpen(
  status: RegistrationWindowStatus,
  startAt: Date,
  endAt: Date,
  now = new Date(),
): boolean {
  if (status !== "OPEN") return false;
  return now >= startAt && now <= endAt;
}

export function canRegisterInWindow(
  window: { status: RegistrationWindowStatus; startAt: Date; endAt: Date },
  now = new Date(),
): boolean {
  return isRegistrationWindowOpen(window.status, window.startAt, window.endAt, now);
}

export function canCancelRegistration(
  window: { status: RegistrationWindowStatus; startAt: Date; endAt: Date },
  now = new Date(),
): boolean {
  return canRegisterInWindow(window, now);
}
