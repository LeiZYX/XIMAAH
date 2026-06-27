import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateResetToken(): string {
  return randomBytes(32).toString("hex");
}

export async function createPasswordResetToken(userId: string) {
  const token = generateResetToken();
  const tokenHash = hashResetToken(token);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

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

export async function sendPasswordResetEmail(email: string, token: string) {
  const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;

  if (process.env.SMTP_HOST) {
    // Placeholder for SMTP integration — log in development
    console.info(`Password reset email for ${email}: ${resetUrl}`);
    return;
  }

  console.info(`[dev] Password reset link for ${email}: ${resetUrl}`);
}
