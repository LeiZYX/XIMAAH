import type { BillingScope, RegistrationType } from "@/generated/prisma/enums";

export type RegistrationNumberPrefix = "IN" | "RI" | "EX";

export interface RegistrationVisibilityFlags {
  visibleToStudent: boolean;
  visibleToTeacher: boolean;
  visibleInStudentPortal: boolean;
  visibleInTeacherPortal: boolean;
  visibleInStudentDocuments: boolean;
  visibleInStudentBilling: boolean;
}

export const NORMAL_VISIBILITY_FLAGS: RegistrationVisibilityFlags = {
  visibleToStudent: true,
  visibleToTeacher: true,
  visibleInStudentPortal: true,
  visibleInTeacherPortal: true,
  visibleInStudentDocuments: true,
  visibleInStudentBilling: true,
};

export const RESTRICTED_VISIBILITY_FLAGS: RegistrationVisibilityFlags = {
  visibleToStudent: false,
  visibleToTeacher: false,
  visibleInStudentPortal: false,
  visibleInTeacherPortal: false,
  visibleInStudentDocuments: false,
  visibleInStudentBilling: false,
};

export const EXTERNAL_VISIBILITY_FLAGS: RegistrationVisibilityFlags = {
  visibleToStudent: false,
  visibleToTeacher: false,
  visibleInStudentPortal: false,
  visibleInTeacherPortal: false,
  visibleInStudentDocuments: true,
  visibleInStudentBilling: false,
};

export function visibilityFlagsForType(type: RegistrationType): RegistrationVisibilityFlags {
  switch (type) {
    case "RESTRICTED_INTERNAL":
      return RESTRICTED_VISIBILITY_FLAGS;
    case "EXTERNAL":
      return EXTERNAL_VISIBILITY_FLAGS;
    default:
      return NORMAL_VISIBILITY_FLAGS;
  }
}

export function isInternalNormalRegistrationType(type: string | null | undefined): boolean {
  return type === "INTERNAL_NORMAL";
}

export function isRestrictedInternalRegistrationType(type: string | null | undefined): boolean {
  return type === "RESTRICTED_INTERNAL";
}

export function isRestrictedRegistrationType(type: string | null | undefined): boolean {
  return isRestrictedInternalRegistrationType(type);
}

export function isExternalRegistrationType(type: string | null | undefined): boolean {
  return type === "EXTERNAL";
}

export function registrationTypeLabel(type: RegistrationType | string): string {
  switch (type) {
    case "INTERNAL_NORMAL":
      return "Internal normal";
    case "RESTRICTED_INTERNAL":
      return "Restricted internal";
    case "EXTERNAL":
      return "External";
    default:
      return String(type);
  }
}

export function registrationTypeBadgeLabel(type: RegistrationType | string): string {
  switch (type) {
    case "INTERNAL_NORMAL":
      return "Internal Assisted";
    case "RESTRICTED_INTERNAL":
      return "Restricted";
    case "EXTERNAL":
      return "External";
    default:
      return registrationTypeLabel(type);
  }
}

export function inferRegistrationTypeFromLegacy(input: {
  registrationSource?: string | null;
  visibility?: string | null;
}): RegistrationType {
  if (input.registrationSource === "EXTERNAL_CANDIDATE") return "EXTERNAL";
  if (input.visibility === "EXAM_OFFICE_ONLY") return "RESTRICTED_INTERNAL";
  return "INTERNAL_NORMAL";
}

export function normalizeRegistrationType(type: string | null | undefined): RegistrationType {
  switch (type) {
    case "INTERNAL_NORMAL":
    case "RESTRICTED_INTERNAL":
    case "EXTERNAL":
      return type;
    case "NORMAL":
      return "INTERNAL_NORMAL";
    case "RESTRICTED":
      return "RESTRICTED_INTERNAL";
    default:
      return "INTERNAL_NORMAL";
  }
}

export function isOfficeOnlyRegistrationType(type: string | null | undefined): boolean {
  return type === "RESTRICTED_INTERNAL" || type === "EXTERNAL";
}

export function isStudentVisibleRegistrationType(type: string | null | undefined): boolean {
  return type === "INTERNAL_NORMAL";
}

export function billingScopeForRegistrationType(registrationType: RegistrationType): BillingScope {
  switch (registrationType) {
    case "RESTRICTED_INTERNAL":
      return "RESTRICTED_BILLING";
    case "EXTERNAL":
      return "EXTERNAL_BILLING";
    default:
      return "NORMAL_BILLING";
  }
}

export function feeStatementStudentVisible(registrationType: RegistrationType): boolean {
  return registrationType === "INTERNAL_NORMAL";
}

export function statementKindForRegistrationType(
  registrationType: RegistrationType,
): "NORMAL" | "RESTRICTED" | "EXTERNAL" {
  switch (registrationType) {
    case "RESTRICTED_INTERNAL":
      return "RESTRICTED";
    case "EXTERNAL":
      return "EXTERNAL";
    default:
      return "NORMAL";
  }
}
