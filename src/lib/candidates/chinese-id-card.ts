import type { Gender } from "@/generated/prisma/enums";

export function parseChineseIdCardDemographics(idNumber: string | null | undefined): {
  gender: Gender | null;
  dateOfBirth: Date | null;
} {
  const normalized = idNumber?.replace(/\s/g, "") ?? "";
  if (!/^\d{17}[\dXx]$/.test(normalized)) {
    return { gender: null, dateOfBirth: null };
  }

  const year = Number(normalized.slice(6, 10));
  const month = Number(normalized.slice(10, 12));
  const day = Number(normalized.slice(12, 14));
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) {
    return { gender: null, dateOfBirth: null };
  }

  const dateOfBirth = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(dateOfBirth.getTime())) {
    return { gender: null, dateOfBirth: null };
  }

  const genderDigit = Number(normalized.charAt(16));
  if (!Number.isFinite(genderDigit)) {
    return { gender: null, dateOfBirth };
  }

  return {
    gender: genderDigit % 2 === 1 ? "MALE" : "FEMALE",
    dateOfBirth,
  };
}
