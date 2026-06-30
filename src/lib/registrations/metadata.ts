import type {
  BillingScope,
  RegistrationSource,
  RegistrationType,
  RegistrationVisibility,
  UserRole,
} from "@/generated/prisma/enums";
import {
  EXTERNAL_VISIBILITY_FLAGS,
  NORMAL_VISIBILITY_FLAGS,
  RESTRICTED_VISIBILITY_FLAGS,
  registrationTypeLabel,
  type RegistrationVisibilityFlags,
} from "@/lib/registrations/registration-type";

export function assistedSourceForRole(role: UserRole): RegistrationSource {
  return role === "EXAM_OFFICER" ? "EO_ASSISTED" : "ADMIN_ASSISTED";
}

export function restrictedSourceForRole(role: UserRole): RegistrationSource {
  return role === "EXAM_OFFICER" ? "EO_FORCED_INTERNAL" : "ADMIN_FORCED_INTERNAL";
}

/** @deprecated Use restrictedSourceForRole */
export const officeOnlySourceForRole = restrictedSourceForRole;

export function postLockSourceForRole(role: UserRole): RegistrationSource {
  return role === "EXAM_OFFICER" ? "EO_POST_LOCK_ADJUSTMENT" : "ADMIN_POST_LOCK_ADJUSTMENT";
}

export function assistedAuditActionForRole(role: UserRole) {
  return role === "EXAM_OFFICER"
    ? "EO_ASSISTED_REGISTRATION_CREATED"
    : "ADMIN_ASSISTED_REGISTRATION_CREATED";
}

export function restrictedAuditActionForRole(role: UserRole) {
  return role === "EXAM_OFFICER"
    ? "EO_RESTRICTED_REGISTRATION_CREATED"
    : "ADMIN_RESTRICTED_REGISTRATION_CREATED";
}

/** @deprecated Use restrictedAuditActionForRole */
export const officeOnlyAuditActionForRole = restrictedAuditActionForRole;

export function postLockAuditActionForRole(role: UserRole) {
  return role === "EXAM_OFFICER" ? "EO_POST_LOCK_ADJUSTMENT" : "ADMIN_POST_LOCK_ADJUSTMENT";
}

export const STUDENT_VISIBLE: RegistrationVisibility[] = ["STUDENT_AND_TEACHER", "STUDENT_ONLY"];

export const TEACHER_VISIBLE: RegistrationVisibility[] = ["STUDENT_AND_TEACHER"];

export const AUTO_BILLING_SCOPES: BillingScope[] = ["NORMAL_BILLING"];

export function registrationSourceLabel(source: RegistrationSource | string): string {
  switch (source) {
    case "STUDENT_SUBMITTED":
      return "Student submitted";
    case "TEACHER_REQUEST_APPROVED":
      return "Teacher request approved";
    case "EO_ASSISTED":
    case "ADMIN_ASSISTED":
      return "Assisted registration";
    case "EO_FORCED_INTERNAL":
    case "ADMIN_FORCED_INTERNAL":
      return "Restricted registration";
    case "EO_POST_LOCK_ADJUSTMENT":
    case "ADMIN_POST_LOCK_ADJUSTMENT":
      return "Post-lock adjustment";
    case "EXTERNAL_CANDIDATE":
      return "External candidate";
    default:
      return String(source);
  }
}

export function visibilityLabel(visibility: RegistrationVisibility | string): string {
  switch (visibility) {
    case "STUDENT_AND_TEACHER":
      return "Student visible";
    case "STUDENT_ONLY":
      return "Student only (teacher hidden)";
    case "EXAM_OFFICE_ONLY":
      return "Restricted (student & teacher hidden)";
    default:
      return String(visibility);
  }
}

export function billingScopeLabel(scope: BillingScope | string): string {
  switch (scope) {
    case "NORMAL_BILLING":
      return "Normal billing";
    case "OFFICE_ONLY_BILLING":
      return "Restricted billing";
    case "NO_BILLING":
      return "No billing";
    case "MANUAL_REVIEW":
      return "Manual review";
    default:
      return String(scope);
  }
}

export function isExternalSource(source: RegistrationSource | string): boolean {
  return source === "EXTERNAL_CANDIDATE";
}

export function flagsForRegistrationType(type: RegistrationType) {
  switch (type) {
    case "RESTRICTED":
      return RESTRICTED_VISIBILITY_FLAGS;
    case "EXTERNAL":
      return EXTERNAL_VISIBILITY_FLAGS;
    default:
      return NORMAL_VISIBILITY_FLAGS;
  }
}

export { registrationTypeLabel, type RegistrationVisibilityFlags };
