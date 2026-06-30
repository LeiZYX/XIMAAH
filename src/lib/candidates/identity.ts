import type { Gender, IdDocumentType } from "@/generated/prisma/enums";
import type { UserRole } from "@/lib/auth/constants";

export interface CandidateIdentityInput {
  chineseName?: string | null;
  surnamePinyin?: string | null;
  givenNamePinyin?: string | null;
  preferredEnglishName?: string | null;
  legalEnglishName?: string | null;
  gender?: Gender | null;
  dateOfBirth?: Date | string | null;
  nationality?: string | null;
  idDocumentType?: IdDocumentType | null;
  idDocumentNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  studentNumber?: string | null;
  grade?: string | null;
  className?: string | null;
  graduationYear?: number | null;
  assessmentHubCandidateNumber?: string | null;
  status?: string | null;
}

export function computeDisplayName(candidate: {
  preferredEnglishName?: string | null;
  legalEnglishName?: string | null;
  englishName?: string | null;
}): string {
  const preferred = candidate.preferredEnglishName?.trim();
  if (preferred) return preferred;
  const legal = candidate.legalEnglishName?.trim();
  if (legal) return legal;
  return candidate.englishName?.trim() ?? "";
}

export function genderLabel(gender: Gender | string | null | undefined): string {
  switch (gender) {
    case "MALE":
      return "Male";
    case "FEMALE":
      return "Female";
    case "OTHER":
      return "Other";
    case "PREFER_NOT_TO_SAY":
      return "Prefer not to say";
    default:
      return "—";
  }
}

export const GENDER_OPTIONS: Array<{ value: Gender; label: string }> = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
  { value: "PREFER_NOT_TO_SAY", label: "Prefer not to say" },
];

export function idDocumentTypeLabel(type: IdDocumentType | string | null | undefined): string {
  switch (type) {
    case "CHINESE_ID_CARD":
      return "Chinese ID Card";
    case "PASSPORT":
      return "Passport";
    case "HONG_KONG_ID":
      return "Hong Kong ID";
    case "MACAU_ID":
      return "Macau ID";
    case "TAIWAN_ID":
      return "Taiwan ID";
    case "OTHER":
      return "Other";
    default:
      return "—";
  }
}

export const ID_DOCUMENT_TYPE_OPTIONS: Array<{ value: IdDocumentType; label: string }> = [
  { value: "CHINESE_ID_CARD", label: "Chinese ID Card" },
  { value: "PASSPORT", label: "Passport" },
  { value: "HONG_KONG_ID", label: "Hong Kong ID" },
  { value: "MACAU_ID", label: "Macau ID" },
  { value: "TAIWAN_ID", label: "Taiwan ID" },
  { value: "OTHER", label: "Other" },
];

export function maskIdDocumentNumber(value: string | null | undefined): string {
  if (!value) return "—";
  const trimmed = value.trim();
  if (trimmed.length <= 4) return "****";
  return `${"*".repeat(Math.max(trimmed.length - 4, 4))}${trimmed.slice(-4)}`;
}

export function validateCandidateIdentity(input: CandidateIdentityInput): string[] {
  const errors: string[] = [];
  if (!input.chineseName?.trim()) errors.push("Chinese Name is required");
  if (!input.surnamePinyin?.trim()) errors.push("Surname (Pinyin) is required");
  if (!input.givenNamePinyin?.trim()) errors.push("Given Name (Pinyin) is required");
  if (!input.legalEnglishName?.trim()) errors.push("Legal English Name is required");
  if (!input.gender) errors.push("Gender is required");
  if (!input.dateOfBirth) errors.push("Date of Birth is required");
  if (!input.idDocumentType) errors.push("ID Document Type is required");
  if (!input.idDocumentNumber?.trim()) errors.push("ID / Passport Number is required");
  if (!input.assessmentHubCandidateNumber?.trim()) errors.push("Candidate Number is required");
  return errors;
}

export function parseDateOfBirth(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const text = String(value).trim();
  if (!text) return null;
  const date = new Date(`${text.slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateOfBirth(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toISOString().slice(0, 10);
}

export function buildCandidateIdentityUpdate(input: CandidateIdentityInput) {
  const legalEnglishName = input.legalEnglishName?.trim() || null;
  const preferredEnglishName = input.preferredEnglishName?.trim() || null;
  const displayName = computeDisplayName({ preferredEnglishName, legalEnglishName });
  const idDocumentNumber = input.idDocumentNumber?.trim() || null;

  return {
    chineseName: input.chineseName?.trim() || null,
    surnamePinyin: input.surnamePinyin?.trim() || null,
    givenNamePinyin: input.givenNamePinyin?.trim() || null,
    preferredEnglishName,
    legalEnglishName,
    englishName: displayName || legalEnglishName || "",
    gender: input.gender ?? null,
    dateOfBirth: parseDateOfBirth(input.dateOfBirth),
    nationality: input.nationality?.trim() || null,
    idDocumentType: input.idDocumentType ?? null,
    idDocumentNumber,
    idNumber: input.idDocumentType === "CHINESE_ID_CARD" ? idDocumentNumber : null,
    passportNumber: input.idDocumentType === "PASSPORT" ? idDocumentNumber : null,
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    emergencyContactName: input.emergencyContactName?.trim() || null,
    emergencyContactPhone: input.emergencyContactPhone?.trim() || null,
    studentNumber: input.studentNumber?.trim() || null,
    grade: input.grade?.trim() || null,
    className: input.className?.trim() || null,
    graduationYear: input.graduationYear ?? null,
    assessmentHubCandidateNumber: input.assessmentHubCandidateNumber?.trim() || "",
    status: input.status as never | undefined,
  };
}

export type CandidateProfileRecord = {
  id: string;
  candidateType: string;
  englishName: string;
  chineseName?: string | null;
  surnamePinyin?: string | null;
  givenNamePinyin?: string | null;
  preferredEnglishName?: string | null;
  legalEnglishName?: string | null;
  gender?: Gender | null;
  dateOfBirth?: Date | string | null;
  nationality?: string | null;
  idDocumentType?: IdDocumentType | null;
  idDocumentNumber?: string | null;
  idNumber?: string | null;
  passportNumber?: string | null;
  photoUrl?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  studentNumber?: string | null;
  grade?: string | null;
  className?: string | null;
  graduationYear?: number | null;
  status?: string | null;
  email?: string | null;
  phone?: string | null;
  assessmentHubCandidateNumber?: string | null;
  loginEnabled?: boolean | null;
  examIdentities?: Array<Record<string, unknown>>;
  registrationWorkspaces?: Array<Record<string, unknown>>;
  feeStatements?: Array<Record<string, unknown>>;
  user?: Record<string, unknown> | null;
};

export function sanitizeCandidateForRole<T extends CandidateProfileRecord>(
  candidate: T,
  role: UserRole,
): T {
  if (role === "ADMIN" || role === "EXAM_OFFICER") {
    return candidate;
  }

  if (role === "SUBJECT_TEACHER") {
    return {
      ...candidate,
      idDocumentNumber: undefined,
      idNumber: undefined,
      passportNumber: undefined,
      idDocumentType: undefined,
      dateOfBirth: undefined,
      nationality: undefined,
      emergencyContactName: undefined,
      emergencyContactPhone: undefined,
      email: undefined,
      phone: undefined,
      photoUrl: undefined,
    };
  }

  return candidate;
}

export function candidateDocumentProfile(row: {
  candidate?: CandidateProfileRecord | null;
  studentNameSnapshot: string;
  studentNoSnapshot: string;
  gradeSnapshot: string;
  classNameSnapshot: string;
  assessmentHubCandidateNumberSnapshot: string | null;
  candidateTypeSnapshot?: string | null;
}) {
  const candidate = row.candidate;
  const displayName = candidate ? computeDisplayName(candidate) : row.studentNameSnapshot;
  const idDocumentNumber =
    candidate?.idDocumentNumber ?? candidate?.idNumber ?? candidate?.passportNumber ?? null;

  return {
    displayName,
    chineseName: candidate?.chineseName ?? null,
    photoUrl: candidate?.photoUrl ?? null,
    candidateNumber: row.assessmentHubCandidateNumberSnapshot ?? candidate?.assessmentHubCandidateNumber ?? "—",
    studentNumber: row.studentNoSnapshot ?? candidate?.studentNumber ?? "—",
    grade: row.gradeSnapshot ?? candidate?.grade ?? "—",
    className: row.classNameSnapshot ?? candidate?.className ?? "—",
    gender: candidate?.gender ?? null,
    genderLabel: genderLabel(candidate?.gender),
    dateOfBirth: formatDateOfBirth(candidate?.dateOfBirth),
    nationality: candidate?.nationality ?? "—",
    idDocumentType: candidate?.idDocumentType ?? null,
    idDocumentTypeLabel: idDocumentTypeLabel(candidate?.idDocumentType),
    idDocumentNumber: idDocumentNumber ?? "—",
    candidateType: row.candidateTypeSnapshot ?? candidate?.candidateType ?? "INTERNAL",
  };
}
