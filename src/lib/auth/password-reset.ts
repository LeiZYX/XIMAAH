import { createHash, randomBytes } from "crypto";
import type { UserAuditAction } from "@/generated/prisma/enums";
import { sendMail, isSmtpConfigured } from "@/lib/mail/smtp";
import { getResolvedEmailSettings } from "@/lib/mail/email-settings";
import { logUserAudit } from "@/lib/users/audit";
import { prisma } from "@/lib/prisma";

async function resetTokenTtlMsFromSettings(): Promise<number> {
  const settings = await getResolvedEmailSettings();
  return settings.passwordResetExpiresMinutes * 60 * 1000;
}

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateResetToken(): string {
  return randomBytes(32).toString("hex");
}

export async function getPasswordResetUrl(token: string): Promise<string> {
  const settings = await getResolvedEmailSettings();
  const baseUrl = settings.appUrl || "http://localhost:3000";
  return `${baseUrl.replace(/\/$/, "")}/reset-password?token=${token}`;
}

export async function createPasswordResetToken(userId: string) {
  const token = generateResetToken();
  const tokenHash = hashResetToken(token);
  const expiresAt = new Date(Date.now() + (await resetTokenTtlMsFromSettings()));

  await prisma.passwordResetToken.deleteMany({ where: { userId } });
  await prisma.passwordResetToken.create({
    data: { userId, tokenHash, expiresAt },
  });

  return { token, expiresAt };
}

export async function consumePasswordResetToken(token: string) {
  const tokenHash = hashResetToken(token);
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return null;
  }

  await prisma.passwordResetToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });

  return record.user;
}

export async function sendPasswordResetEmail(
  email: string,
  token: string,
  options?: { performedById?: string; auditAction?: UserAuditAction },
) {
  const resetUrl = await getPasswordResetUrl(token);
  const subject = "Reset your XIMA Assessment Hub password";
  const text = `Use this link to reset your password (expires soon):\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`;

  if (await isSmtpConfigured()) {
    await sendMail({ to: email, subject, text });
    return { delivered: true, mode: "smtp" as const };
  }

  if (process.env.NODE_ENV !== "production") {
    console.info(`[dev] Password reset link for ${email}: ${resetUrl}`);
    return { delivered: false, mode: "console" as const, resetUrl };
  }

  return { delivered: false, mode: "unconfigured" as const };
}

export async function requestPasswordResetForUser(
  user: { id: string; email: string | null; isActive: boolean },
  options?: { performedById?: string },
) {
  if (!user.isActive || !user.email) {
    return null;
  }

  const { token } = await createPasswordResetToken(user.id);
  await sendPasswordResetEmail(user.email, token);

  if (options?.performedById) {
    await logUserAudit({
      action: "PASSWORD_RESET_REQUESTED",
      performedById: options.performedById,
      targetUserId: user.id,
    });
  }

  return token;
}
