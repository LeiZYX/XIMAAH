import { prisma } from "@/lib/prisma";

export interface ResolvedEmailSettings {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassword: string;
  mailFrom: string;
  passwordResetExpiresMinutes: number;
  appUrl: string;
  smtpConfigured: boolean;
  hasStoredPassword: boolean;
}

const SETTINGS_ID = "default";

function envFallback() {
  return {
    smtpHost: process.env.SMTP_HOST?.trim() || "",
    smtpPort: Number(process.env.SMTP_PORT ?? 587),
    smtpSecure: process.env.SMTP_SECURE === "true",
    smtpUser: process.env.SMTP_USER?.trim() || "",
    smtpPassword: process.env.SMTP_PASSWORD || "",
    mailFrom:
      process.env.MAIL_FROM?.trim() || process.env.SMTP_USER?.trim() || "",
    passwordResetExpiresMinutes: Number(
      process.env.PASSWORD_RESET_EXPIRES_MINUTES ?? 60,
    ),
    appUrl:
      process.env.APP_URL?.trim() ||
      process.env.APP_BASE_URL?.trim() ||
      process.env.NEXTAUTH_URL?.trim() ||
      "http://localhost:3000",
  };
}

export async function getResolvedEmailSettings(): Promise<ResolvedEmailSettings> {
  const env = envFallback();
  const stored = await prisma.systemEmailSettings.findUnique({
    where: { id: SETTINGS_ID },
  });

  const smtpHost = stored?.smtpHost?.trim() || env.smtpHost;
  const smtpPort = stored?.smtpPort ?? env.smtpPort;
  const smtpSecure = stored?.smtpSecure ?? env.smtpSecure;
  const smtpUser = stored?.smtpUser?.trim() || env.smtpUser;
  const smtpPassword = stored?.smtpPassword || env.smtpPassword;
  const mailFrom = stored?.mailFrom?.trim() || env.mailFrom;
  const passwordResetExpiresMinutes =
    stored?.passwordResetExpiresMinutes ?? env.passwordResetExpiresMinutes;
  const appUrl = stored?.appUrl?.trim() || env.appUrl;

  return {
    smtpHost,
    smtpPort: Number.isFinite(smtpPort) && smtpPort > 0 ? smtpPort : 587,
    smtpSecure,
    smtpUser,
    smtpPassword,
    mailFrom,
    passwordResetExpiresMinutes:
      Number.isFinite(passwordResetExpiresMinutes) && passwordResetExpiresMinutes > 0
        ? passwordResetExpiresMinutes
        : 60,
    appUrl,
    smtpConfigured: Boolean(smtpHost && mailFrom),
    hasStoredPassword: Boolean(stored?.smtpPassword),
  };
}

export interface EmailSettingsInput {
  smtpHost?: string | null;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string | null;
  smtpPassword?: string | null;
  mailFrom?: string | null;
  passwordResetExpiresMinutes?: number;
  appUrl?: string | null;
}

export async function saveEmailSettings(input: EmailSettingsInput) {
  const existing = await prisma.systemEmailSettings.findUnique({
    where: { id: SETTINGS_ID },
  });

  const data = {
    smtpHost: input.smtpHost?.trim() || null,
    smtpPort:
      typeof input.smtpPort === "number" && input.smtpPort > 0 ? input.smtpPort : 587,
    smtpSecure: input.smtpSecure ?? false,
    smtpUser: input.smtpUser?.trim() || null,
    mailFrom: input.mailFrom?.trim() || null,
    passwordResetExpiresMinutes:
      typeof input.passwordResetExpiresMinutes === "number" &&
      input.passwordResetExpiresMinutes > 0
        ? input.passwordResetExpiresMinutes
        : 60,
    appUrl: input.appUrl?.trim() || null,
    ...(input.smtpPassword?.trim()
      ? { smtpPassword: input.smtpPassword }
      : existing
        ? {}
        : { smtpPassword: null }),
  };

  await prisma.systemEmailSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, ...data },
    update: data,
  });

  return getResolvedEmailSettings();
}
