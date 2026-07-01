import type { UserRole } from "@/lib/auth/constants";

export const ROLE_HOME: Record<UserRole, string> = {
  ADMIN: "/admin",
  EXAM_OFFICER: "/exam-office",
  SUBJECT_TEACHER: "/teacher",
  STUDENT: "/student",
};

export function homePathForRole(role: UserRole): string {
  return ROLE_HOME[role];
}

export function canAccessAdminArea(role: UserRole): boolean {
  return role === "ADMIN";
}

export function canAccessExamOffice(role: UserRole): boolean {
  return role === "ADMIN" || role === "EXAM_OFFICER";
}

export function canAccessTeacherArea(role: UserRole): boolean {
  return role === "SUBJECT_TEACHER";
}

export function canAccessStudentArea(role: UserRole): boolean {
  return role === "STUDENT";
}

export function canManageExamData(role: UserRole): boolean {
  return role === "ADMIN";
}

export function canManageRegistrationWindows(role: UserRole): boolean {
  return role === "ADMIN" || role === "EXAM_OFFICER";
}

export {
  canConfigureFeeRules,
  canGenerateFeeStatements,
  canViewFeeRuleCosts,
  canViewStudentFeeStatements,
} from "@/lib/config/fees";

export function canViewAllRegistrations(role: UserRole): boolean {
  return role === "ADMIN" || role === "EXAM_OFFICER";
}

export function canManageUsers(role: UserRole): boolean {
  return role === "ADMIN";
}

export function canManageStudentLifecycle(role: UserRole): boolean {
  return role === "ADMIN" || role === "EXAM_OFFICER";
}

export function canPermanentlyDeleteStudent(role: UserRole): boolean {
  return role === "ADMIN";
}

export function loginIdentifiersForRole(role: UserRole): string {
  switch (role) {
    case "ADMIN":
    case "EXAM_OFFICER":
      return "username or email";
    case "SUBJECT_TEACHER":
      return "phone or email";
    case "STUDENT":
      return "phone, email, or student number";
    default:
      return "email";
  }
}
