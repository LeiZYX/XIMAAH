import nodemailer from "nodemailer";
import { getResolvedEmailSettings } from "@/lib/mail/email-settings";

export async function getSmtpConfig() {
  const settings = await getResolvedEmailSettings();
  return {
    host: settings.smtpHost,
    port: settings.smtpPort,
    secure: settings.smtpSecure,
    user: settings.smtpUser,
    password: settings.smtpPassword,
    from: settings.mailFrom,
  };
}

export async function isSmtpConfigured(): Promise<boolean> {
  const settings = await getResolvedEmailSettings();
  return settings.smtpConfigured;
}

export async function sendMail(options: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}) {
  const config = await getSmtpConfig();
  if (!config.host || !config.from) {
    return { sent: false as const, reason: "SMTP not configured" };
  }

  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user
      ? {
          user: config.user,
          pass: config.password,
        }
      : undefined,
  });

  await transport.sendMail({
    from: config.from,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html ?? options.text,
  });

  return { sent: true as const };
}
