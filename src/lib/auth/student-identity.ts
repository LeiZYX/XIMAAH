import { GRADE_LABELS, type GradeValue } from "@/lib/students/profile-enums";

export type StudentIdentityFields = {
  name: string;
  chineseName?: string | null;
  preferredEnglishName?: string | null;
  studentNo?: string | null;
  currentGrade?: string | null;
  currentClassName?: string | null;
};

function trimOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function resolveSchoolNo(identity: StudentIdentityFields): string | null {
  return trimOrNull(identity.studentNo);
}

export function resolveDisplayEnglishName(identity: StudentIdentityFields): string {
  return (
    trimOrNull(identity.preferredEnglishName) ||
    trimOrNull(identity.name) ||
    "Student"
  );
}

export function resolveChineseName(identity: StudentIdentityFields): string | null {
  return trimOrNull(identity.chineseName);
}

export function formatGradeClassLine(identity: StudentIdentityFields): string | null {
  const gradeKey = trimOrNull(identity.currentGrade);
  const grade =
    gradeKey && gradeKey in GRADE_LABELS
      ? GRADE_LABELS[gradeKey as GradeValue]
      : gradeKey;
  const className = trimOrNull(identity.currentClassName);
  if (grade && className) return `${grade} · Class ${className}`;
  if (grade) return grade;
  if (className) return `Class ${className}`;
  return null;
}

/** Desktop header: English · Chinese · School No. */
export function formatStudentHeaderLabel(identity: StudentIdentityFields): string {
  const parts = [
    resolveDisplayEnglishName(identity),
    resolveChineseName(identity),
    resolveSchoolNo(identity),
  ].filter(Boolean);
  return parts.join(" · ");
}

/** Mobile header: prefer School No., then Chinese, then English. */
export function formatStudentMobileHeaderLabel(identity: StudentIdentityFields): string {
  return (
    resolveSchoolNo(identity) ||
    resolveChineseName(identity) ||
    resolveDisplayEnglishName(identity)
  );
}
