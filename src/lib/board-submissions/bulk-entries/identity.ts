import type { CandidateType, Gender, RegistrationType } from "@/generated/prisma/enums";

type CandidateDemographicsSource = {
  gender: Gender | null;
  dateOfBirth: Date | null;
  candidateType?: CandidateType | null;
  user?: {
    studentProfile?: {
      gender: Gender | null;
    } | null;
  } | null;
};

export function resolveBulkEntriesDemographics(source: CandidateDemographicsSource) {
  return {
    gender: source.gender ?? source.user?.studentProfile?.gender ?? null,
    dateOfBirth: source.dateOfBirth ?? null,
  };
}

export function registrationTypeLabel(type: RegistrationType): string {
  switch (type) {
    case "INTERNAL_NORMAL":
      return "Internal";
    case "RESTRICTED_INTERNAL":
      return "Restricted";
    case "EXTERNAL":
      return "External";
    default:
      return type;
  }
}

export function formatRegistrationTypes(types: RegistrationType[]): string {
  const unique = [...new Set(types)];
  return unique.map(registrationTypeLabel).sort().join(", ");
}
