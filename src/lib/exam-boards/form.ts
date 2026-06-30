import type { ExamBoardCentreFields } from "@/lib/exam-boards/centre";

function optionalString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

export interface ExamBoardWriteInput {
  name: string;
  code: string;
  country: string;
  description?: string | null;
  region?: string | null;
  website?: string | null;
  timezone?: string | null;
}

export function parseExamBoardCentreFields(
  data: Record<string, unknown>,
): ExamBoardCentreFields {
  return {
    centreName: optionalString(data.centreName),
    centreNumber: optionalString(data.centreNumber),
    centreAddress: optionalString(data.centreAddress),
    centreEmail: optionalString(data.centreEmail),
    centrePhone: optionalString(data.centrePhone),
    centreCountry: optionalString(data.centreCountry),
    centreTimeZone: optionalString(data.centreTimeZone),
    defaultExamOfficerName: optionalString(data.defaultExamOfficerName),
    defaultExamOfficerEmail: optionalString(data.defaultExamOfficerEmail),
  };
}

export function examBoardWriteData(
  data: ExamBoardWriteInput & ExamBoardCentreFields,
) {
  return {
    name: data.name.trim(),
    code: String(data.code).toUpperCase().trim(),
    country: String(data.country).toUpperCase().trim(),
    description: data.description ? String(data.description) : null,
    region: data.region ? String(data.region) : null,
    website: data.website ? String(data.website) : null,
    timezone: data.timezone ? String(data.timezone) : null,
    centreName: data.centreName ?? null,
    centreNumber: data.centreNumber ?? null,
    centreAddress: data.centreAddress ?? null,
    centreEmail: data.centreEmail ?? null,
    centrePhone: data.centrePhone ?? null,
    centreCountry: data.centreCountry ?? null,
    centreTimeZone: data.centreTimeZone ?? null,
    defaultExamOfficerName: data.defaultExamOfficerName ?? null,
    defaultExamOfficerEmail: data.defaultExamOfficerEmail ?? null,
  };
}

export const emptyExamBoardCentreForm = {
  centreName: "",
  centreNumber: "",
  centreAddress: "",
  centreEmail: "",
  centrePhone: "",
  centreCountry: "",
  centreTimeZone: "",
  defaultExamOfficerName: "",
  defaultExamOfficerEmail: "",
};
