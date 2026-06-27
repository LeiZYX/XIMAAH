export const SESSION_COOKIE = "xima_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export const ADMIN_ROLES = ["ADMIN", "EDITOR"] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];
