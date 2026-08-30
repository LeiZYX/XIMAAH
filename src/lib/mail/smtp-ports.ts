/** Aliyun Mail (阿里邮箱) SMTP ports per official docs. */
export const ALIYUN_MAIL_SMTP_HOST = "smtp.qiye.aliyun.com";

/** Recommended ports: 465 (SSL), 80, 25. ECS often blocks 25. */
export const ALIYUN_MAIL_SMTP_PORTS = [465, 80, 25] as const;

export type AliyunMailSmtpPort = (typeof ALIYUN_MAIL_SMTP_PORTS)[number];

export function normalizeSmtpSecure(port: number, secure?: boolean | null): boolean {
  if (port === 465) return true;
  if (secure === true) return true;
  return false;
}

export function describeSmtpPort(port: number): string {
  switch (port) {
    case 465:
      return "SSL/TLS (recommended for Aliyun Mail / ECS)";
    case 80:
      return "Plain SMTP (Aliyun Mail; no SSL checkbox)";
    case 25:
      return "Plain SMTP (often blocked on cloud ECS — prefer 465 or 80)";
    case 587:
      return "STARTTLS (common elsewhere; not listed for Aliyun Mail)";
    default:
      return "Custom SMTP port";
  }
}
