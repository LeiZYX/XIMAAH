import type { Gender, Grade } from "@/generated/prisma/enums";

export const GRADE_VALUES = ["G9", "G10", "G11", "G12"] as const satisfies readonly Grade[];
export const GENDER_VALUES = ["MALE", "FEMALE", "OTHER", "UNKNOWN"] as const;

export type GradeValue = (typeof GRADE_VALUES)[number];
export type GenderValue = (typeof GENDER_VALUES)[number];

export const GRADE_LABELS: Record<GradeValue, string> = {
  G9: "Grade 9",
  G10: "Grade 10",
  G11: "Grade 11",
  G12: "Grade 12",
};

export const GENDER_LABELS: Record<GenderValue, string> = {
  MALE: "Male",
  FEMALE: "Female",
  OTHER: "Other",
  UNKNOWN: "Unknown",
};

const GRADE_ALIASES: Record<string, GradeValue> = {
  G9: "G9",
  G10: "G10",
  G11: "G11",
  G12: "G12",
  "9": "G9",
  "10": "G10",
  "11": "G11",
  "12": "G12",
  YEAR9: "G9",
  YEAR10: "G10",
  YEAR11: "G11",
  YEAR12: "G12",
};

export function parseGradeInput(value: unknown): Grade | undefined {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  if (!normalized) return undefined;
  return GRADE_ALIASES[normalized];
}

export function parseGenderInput(value: unknown): Gender | undefined {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "MALE" || normalized === "M") return "MALE";
  if (normalized === "FEMALE" || normalized === "F") return "FEMALE";
  if (normalized === "OTHER") return "OTHER";
  if (normalized === "UNKNOWN") return "UNKNOWN";
  if (normalized === "PREFER_NOT_TO_SAY") return "PREFER_NOT_TO_SAY";
  if (value === "男") return "MALE";
  if (value === "女") return "FEMALE";
  return undefined;
}

export function parseDateOfBirthInput(value: unknown): Date | undefined {
  const raw = String(value ?? "").trim();
  if (!raw) return undefined;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const date = new Date(`${raw}T00:00:00.000Z`);
    if (!Number.isNaN(date.getTime())) return date;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSXDateToJS(value);
    if (parsed) return parsed;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  return undefined;
}

function XLSXDateToJS(serial: number): Date | undefined {
  if (serial < 1) return undefined;
  const utcDays = Math.floor(serial - 25569);
  const date = new Date(utcDays * 86400 * 1000);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function formatDateOfBirth(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
