import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canManageUsers } from "@/lib/auth/permissions";
import {
  getResolvedEmailSettings,
  saveEmailSettings,
} from "@/lib/mail/email-settings";
import { isSmtpConfigured, sendMail } from "@/lib/mail/smtp";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const auth = await requireAuth(["ADMIN"]);
  if (auth.error) return auth.error;
  if (!canManageUsers(auth.user.role)) return jsonError("Forbidden", 403);

  try {
    const settings = await getResolvedEmailSettings();
    return NextResponse.json({
      smtpConfigured: settings.smtpConfigured,
      smtpHost: settings.smtpHost || null,
      smtpPort: settings.smtpPort,
      smtpSecure: settings.smtpSecure,
      smtpUser: settings.smtpUser || null,
      mailFrom: settings.mailFrom || null,
      hasStoredPassword: settings.hasStoredPassword,
      passwordResetExpiresMinutes: settings.passwordResetExpiresMinutes,
      appUrl: settings.appUrl || null,
    });
  } catch (error) {
    console.error("GET /api/admin/users/password-settings failed:", error);
    return jsonError(
      error instanceof Error ? error.message : "Failed to load email settings",
      500,
    );
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireAuth(["ADMIN"]);
  if (auth.error) return auth.error;
  if (!canManageUsers(auth.user.role)) return jsonError("Forbidden", 403);

  const body = await request.json();
  const data = parseJsonBody<{
    smtpHost?: string | null;
    smtpPort?: number;
    smtpSecure?: boolean;
    smtpUser?: string | null;
    smtpPassword?: string | null;
    mailFrom?: string | null;
    passwordResetExpiresMinutes?: number;
    appUrl?: string | null;
  }>(body, []);

  if (!data) return jsonError("Invalid request body");

  const settings = await saveEmailSettings(data);
  return NextResponse.json({
    smtpConfigured: settings.smtpConfigured,
    smtpHost: settings.smtpHost || null,
    smtpPort: settings.smtpPort,
    smtpSecure: settings.smtpSecure,
    smtpUser: settings.smtpUser || null,
    mailFrom: settings.mailFrom || null,
    hasStoredPassword: settings.hasStoredPassword,
    passwordResetExpiresMinutes: settings.passwordResetExpiresMinutes,
    appUrl: settings.appUrl || null,
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(["ADMIN"]);
  if (auth.error) return auth.error;
  if (!canManageUsers(auth.user.role)) return jsonError("Forbidden", 403);

  const body = await request.json();
  const data = parseJsonBody<{ testEmail: string }>(body, ["testEmail"]);
  if (!data) return jsonError("testEmail is required");

  if (!(await isSmtpConfigured())) {
    return jsonError("SMTP is not configured", 400);
  }

  await sendMail({
    to: data.testEmail,
    subject: "XIMA Assessment Hub SMTP test",
    text: "This is a test email from XIMA Assessment Hub.",
  });

  return NextResponse.json({ ok: true });
}
