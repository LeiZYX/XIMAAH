export const SESSION_COOKIE = "xima_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export const USER_ROLES = [
  "ADMIN",
  "EXAM_OFFICER",
  "SUBJECT_TEACHER",
  "STUDENT",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export function isUserRole(value: string): value is UserRole {
  return USER_ROLES.includes(value as UserRole);
}

/** @deprecated use ADMIN_ROLES from permissions */
export const ADMIN_ROLES = ["ADMIN"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];
