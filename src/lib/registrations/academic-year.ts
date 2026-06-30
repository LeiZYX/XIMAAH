/** UK-style academic year label, e.g. "2026/27" (September–August). */

const ACADEMIC_YEAR_PATTERN = /^(\d{4})\/(\d{2})$/;

export function formatAcademicYear(startYear: number): string {
  const endShort = String(startYear + 1).slice(-2);
  return `${startYear}/${endShort}`;
}

export function parseAcademicYear(value: string): { startYear: number; endYear: number } | null {
  const match = value.trim().match(ACADEMIC_YEAR_PATTERN);
  if (!match) return null;
  const startYear = Number(match[1]);
  const endShort = Number(match[2]);
  const endYear = Math.floor(startYear / 100) * 100 + endShort;
  if (endYear !== startYear + 1) return null;
  return { startYear, endYear };
}

/** Academic year start year for a calendar date (September boundary). */
export function academicYearStartForDate(date: Date): number {
  const month = date.getUTCMonth() + 1;
  const year = date.getUTCFullYear();
  return month >= 9 ? year : year - 1;
}

export function getAcademicYearForDate(date: Date = new Date()): string {
  return formatAcademicYear(academicYearStartForDate(date));
}

export function getCurrentAcademicYear(): string {
  return getAcademicYearForDate(new Date());
}

/**
 * Exam sessions labelled by calendar year (e.g. Summer 2027) belong to the prior academic year.
 * Summer/June/October 2027 → 2026/27.
 */
export function inferAcademicYearFromExamYear(examYear: number): string {
  return formatAcademicYear(examYear - 1);
}

export function inferAcademicYearFromRegistrationOpenAt(openAt: Date): string {
  return getAcademicYearForDate(openAt);
}

export function listRecentAcademicYears(
  anchor: string = getCurrentAcademicYear(),
  count = 6,
): string[] {
  const parsed = parseAcademicYear(anchor);
  const startYear = parsed?.startYear ?? academicYearStartForDate(new Date());
  return Array.from({ length: count }, (_, index) => formatAcademicYear(startYear - index));
}

export function mergeAcademicYearOptions(
  fromDatabase: string[],
  anchor: string = getCurrentAcademicYear(),
): string[] {
  const merged = new Set<string>([anchor, ...fromDatabase, ...listRecentAcademicYears(anchor, 4)]);
  return [...merged].sort((a, b) => {
    const pa = parseAcademicYear(a);
    const pb = parseAcademicYear(b);
    return (pb?.startYear ?? 0) - (pa?.startYear ?? 0);
  });
}

export function isValidAcademicYear(value: string): boolean {
  return parseAcademicYear(value) !== null;
}
