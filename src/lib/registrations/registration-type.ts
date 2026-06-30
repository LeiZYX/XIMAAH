import type { RegistrationType } from "@/generated/prisma/enums";

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
    case "RESTRICTED":
      return RESTRICTED_VISIBILITY_FLAGS;
    case "EXTERNAL":
      return EXTERNAL_VISIBILITY_FLAGS;
    default:
      return NORMAL_VISIBILITY_FLAGS;
  }
}

export function isRestrictedRegistrationType(type: string | null | undefined): boolean {
  return type === "RESTRICTED";
}

export function registrationTypeLabel(type: RegistrationType | string): string {
  switch (type) {
    case "NORMAL":
      return "Normal";
    case "RESTRICTED":
      return "Restricted";
    case "EXTERNAL":
      return "External";
    default:
      return String(type);
  }
}

export function inferRegistrationTypeFromLegacy(input: {
  registrationSource?: string | null;
  visibility?: string | null;
}): RegistrationType {
  if (input.registrationSource === "EXTERNAL_CANDIDATE") return "EXTERNAL";
  if (input.visibility === "EXAM_OFFICE_ONLY") return "RESTRICTED";
  return "NORMAL";
}
