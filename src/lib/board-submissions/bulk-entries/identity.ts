import { parseChineseIdCardDemographics } from "@/lib/candidates/chinese-id-card";
import type { CandidateType, Gender, RegistrationType } from "@/generated/prisma/enums";

type StudentProfileDemographics = {
  gender: Gender | null;
  idCardNumber?: string | null;
};

type CandidateDemographicsSource = {
  gender: Gender | null;
  dateOfBirth: Date | null;
  idNumber?: string | null;
  idDocumentNumber?: string | null;
  candidateType?: CandidateType | null;
  user?: {
    studentProfile?: StudentProfileDemographics | null;
  } | null;
  studentProfile?: StudentProfileDemographics | null;
};

function resolveIdNumber(source: CandidateDemographicsSource): string | null {
  return (
    source.idNumber?.trim() ||
    source.idDocumentNumber?.trim() ||
    source.studentProfile?.idCardNumber?.trim() ||
    source.user?.studentProfile?.idCardNumber?.trim() ||
    null
  );
}

export function resolveBulkEntriesDemographics(source: CandidateDemographicsSource) {
  const profileGender =
    source.studentProfile?.gender ?? source.user?.studentProfile?.gender ?? null;
  let gender = source.gender ?? profileGender ?? null;
  let dateOfBirth = source.dateOfBirth ?? null;

  const idNumber = resolveIdNumber(source);
  if (idNumber) {
    const fromIdCard = parseChineseIdCardDemographics(idNumber);
    gender = gender ?? fromIdCard.gender;
    dateOfBirth = dateOfBirth ?? fromIdCard.dateOfBirth;
  }

  return { gender, dateOfBirth };
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
