import { getResolvedEmailSettings } from "@/lib/mail/email-settings";

export type StudentNotificationKind = "REG_LOCKED" | "FEE_ISSUED";

/**
 * Whether a student business notification may be sent.
 * Password reset is intentionally not covered here.
 */
export async function isStudentNotificationEnabled(
  kind: StudentNotificationKind,
): Promise<{ enabled: boolean; reason?: string }> {
  const settings = await getResolvedEmailSettings();

  if (!settings.studentNotificationsEnabled) {
    return { enabled: false, reason: "Student email notifications are disabled" };
  }

  if (kind === "REG_LOCKED" && !settings.notifyRegistrationLocked) {
    return { enabled: false, reason: "Registration locked emails are disabled" };
  }

  if (kind === "FEE_ISSUED" && !settings.notifyFeeStatementIssued) {
    return { enabled: false, reason: "Fee statement issued emails are disabled" };
  }

  return { enabled: true };
}
