import nodemailer from "nodemailer";
import { getResolvedEmailSettings } from "@/lib/mail/email-settings";
import { normalizeSmtpSecure } from "@/lib/mail/smtp-ports";

export async function getSmtpConfig() {
  const settings = await getResolvedEmailSettings();
  const port = settings.smtpPort;
  const secure = normalizeSmtpSecure(port, settings.smtpSecure);
  return {
    host: settings.smtpHost,
    port,
    secure,
    user: settings.smtpUser,
    password: settings.smtpPassword,
    from: settings.mailFrom,
  };
}

export async function isSmtpConfigured(): Promise<boolean> {
  const settings = await getResolvedEmailSettings();
  return settings.smtpConfigured;
}

function formatSmtpError(error: unknown): string {
  if (!(error instanceof Error)) return "SMTP send failed";
  const message = error.message || "SMTP send failed";
  const lower = message.toLowerCase();
  if (lower.includes("invalid login") || lower.includes("authentication")) {
    return `${message}. For Aliyun Mail use the full mailbox address as SMTP user, and the login password or client security password. Confirm SMTP is enabled in the mailbox.`;
  }
  if (lower.includes("econnrefused") || lower.includes("etimedout") || lower.includes("enotfound")) {
    return `${message}. Check SMTP host (e.g. smtp.qiye.aliyun.com) and port (465 with SSL, or 80). ECS often blocks port 25.`;
  }
  if (lower.includes("wrong version number") || lower.includes("ssl") || lower.includes("tls")) {
    return `${message}. Port 465 requires SSL enabled; ports 80/25 should leave SSL unchecked.`;
  }
  return message;
}

export async function sendMail(options: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}) {
  const config = await getSmtpConfig();
  if (!config.host || !config.from || !config.user || !config.password) {
    return { sent: false as const, reason: "SMTP not configured" };
  }

  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.password,
    },
    connectionTimeout: 20_000,
    greetingTimeout: 20_000,
    socketTimeout: 30_000,
    tls: {
      // Aliyun Mail on 465 uses implicit SSL; keep default verification.
      minVersion: "TLSv1.2",
    },
  });

  try {
    await transport.sendMail({
      from: config.from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html ?? options.text,
    });
  } catch (error) {
    throw new Error(formatSmtpError(error));
  }

  return { sent: true as const };
}
