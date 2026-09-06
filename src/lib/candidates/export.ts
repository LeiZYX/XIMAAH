import type { Candidate } from "@/generated/prisma/client";
import {
  formatDateOfBirth,
  genderLabel,
  idDocumentTypeLabel,
} from "@/lib/candidates/identity";
import { candidateTypeLabel, candidateStatusLabel } from "@/lib/candidates/labels";

type ExportCandidate = Pick<
  Candidate,
  | "assessmentHubCandidateNumber"
  | "candidateType"
  | "studentNumber"
  | "chineseName"
  | "surnamePinyin"
  | "givenNamePinyin"
  | "preferredEnglishName"
  | "firstName"
  | "lastName"
  | "legalEnglishName"
  | "englishName"
  | "gender"
  | "dateOfBirth"
  | "nationality"
  | "idDocumentType"
  | "idDocumentNumber"
  | "email"
  | "phone"
  | "grade"
  | "className"
  | "graduationYear"
  | "status"
  | "emergencyContactName"
  | "emergencyContactPhone"
  | "externalId"
  | "schoolName"
> & {
  examIdentities?: Array<{
    uciNumber: string | null;
    candidateNumber: string | null;
    centreNumber?: string | null;
    examBoard: { code: string; name?: string };
  }>;
};

export const CANDIDATE_IMPORT_HEADERS = [
  "chineseName",
  "preferredEnglishName",
  "firstName",
  "lastName",
  "surnamePinyin",
  "givenNamePinyin",
  "legalEnglishName",
  "gender",
  "dateOfBirth",
  "nationality",
  "idDocumentType",
  "idDocumentNumber",
  "email",
  "phone",
  "candidateType",
  "studentNumber",
  "grade",
  "className",
  "graduationYear",
  "assessmentHubCandidateNumber",
  "examBoard",
  "centreNumber",
  "uci",
  "boardCandidateNumber",
  "emergencyContactName",
  "emergencyContactPhone",
  "externalId",
  "schoolName",
] as const;

function csvEscape(value: unknown): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export function candidatesToCsv(candidates: ExportCandidate[]): string {
  const header = [...CANDIDATE_IMPORT_HEADERS];
  const lines = candidates.map((candidate) => {
    const primaryIdentity = candidate.examIdentities?.[0];
    const firstName = candidate.firstName ?? candidate.givenNamePinyin;
    const lastName = candidate.lastName ?? candidate.surnamePinyin;
    return [
      candidate.chineseName,
      candidate.preferredEnglishName,
      firstName,
      lastName,
      candidate.surnamePinyin ?? lastName,
      candidate.givenNamePinyin ?? firstName,
      candidate.legalEnglishName ?? candidate.englishName,
      candidate.gender ? genderLabel(candidate.gender) : "",
      formatDateOfBirth(candidate.dateOfBirth) === "—" ? "" : formatDateOfBirth(candidate.dateOfBirth),
      candidate.nationality,
      candidate.idDocumentType ? idDocumentTypeLabel(candidate.idDocumentType) : "",
      candidate.idDocumentNumber,
      candidate.email,
      candidate.phone,
      candidateTypeLabel(candidate.candidateType),
      candidate.studentNumber,
      candidate.grade,
      candidate.className,
      candidate.graduationYear,
      candidate.assessmentHubCandidateNumber,
      primaryIdentity?.examBoard?.name ?? primaryIdentity?.examBoard?.code ?? "",
      primaryIdentity?.centreNumber,
      primaryIdentity?.uciNumber,
      primaryIdentity?.candidateNumber,
      candidate.emergencyContactName,
      candidate.emergencyContactPhone,
      candidate.externalId,
      candidate.schoolName,
    ]
      .map(csvEscape)
      .join(",");
  });

  return [header.join(","), ...lines].join("\n");
}

export function parseGenderInput(value: string | undefined): Candidate["gender"] | undefined {
  const raw = value?.trim();
  if (!raw) return undefined;
  const normalized = raw.toUpperCase().replace(/\s+/g, "_");
  if (normalized === "MALE") return "MALE";
  if (normalized === "FEMALE") return "FEMALE";
  if (normalized === "OTHER") return "OTHER";
  if (normalized === "UNKNOWN") return "UNKNOWN";
  if (normalized === "PREFER_NOT_TO_SAY") return "PREFER_NOT_TO_SAY";
  if (raw.toLowerCase() === "prefer not to say") return "PREFER_NOT_TO_SAY";
  return undefined;
}

export function parseIdDocumentTypeInput(value: string | undefined): Candidate["idDocumentType"] | undefined {
  const normalized = value?.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (!normalized) return undefined;
  const map: Record<string, NonNullable<Candidate["idDocumentType"]>> = {
    CHINESE_ID_CARD: "CHINESE_ID_CARD",
    CHINESE_ID: "CHINESE_ID_CARD",
    PASSPORT: "PASSPORT",
    HONG_KONG_ID: "HONG_KONG_ID",
    MACAU_ID: "MACAU_ID",
    TAIWAN_ID: "TAIWAN_ID",
    OTHER: "OTHER",
  };
  return map[normalized];
}

export function parseCandidateTypeInput(value: string | undefined): Candidate["candidateType"] | undefined {
  const normalized = value?.trim().toUpperCase();
  if (normalized === "INTERNAL" || normalized === "EXTERNAL") return normalized;
  return undefined;
}

export function candidateStatusFromLabel(value: string | undefined): Candidate["status"] | undefined {
  const normalized = value?.trim().toUpperCase();
  if (
    normalized === "ACTIVE" ||
    normalized === "GRADUATED" ||
    normalized === "LEFT" ||
    normalized === "INACTIVE"
  ) {
    return normalized;
  }
  return undefined;
}
