import type { Prisma } from "@/generated/prisma/client";
import type {
  RegistrationType,
  RegistrationVisibility,
  UserRole,
} from "@/generated/prisma/enums";
import { STUDENT_VISIBLE, TEACHER_VISIBLE } from "@/lib/registrations/metadata";
import {
  isExternalRegistrationType,
  isRestrictedInternalRegistrationType,
  isStudentVisibleRegistrationType,
} from "@/lib/registrations/registration-type";
import { prisma } from "@/lib/prisma";

export const HIDDEN_PORTAL_REGISTRATION_TYPES: RegistrationType[] = [
  "RESTRICTED_INTERNAL",
  "EXTERNAL",
];

export interface RegistrationVisibilityFields {
  registrationType: RegistrationType | string;
  visibility: RegistrationVisibility | string;
  visibleToStudent?: boolean;
  visibleToTeacher?: boolean;
  visibleInStudentPortal?: boolean;
  visibleInTeacherPortal?: boolean;
  status?: string;
  subjectId?: string;
  gradeSnapshot?: string;
  classNameSnapshot?: string;
}

export interface TeacherRegistrationScope {
  subjectIds: string[];
  visibleGrades: string[];
  visibleClasses: string[];
}

function parseJsonStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

export function isOfficeOnlyVisibility(visibility: string | null | undefined): boolean {
  return visibility === "EXAM_OFFICE_ONLY";
}

export function isHiddenFromStudentPortal(row: RegistrationVisibilityFields): boolean {
  return (
    isOfficeOnlyVisibility(row.visibility) ||
    isRestrictedInternalRegistrationType(row.registrationType) ||
    isExternalRegistrationType(row.registrationType) ||
    row.visibleToStudent === false ||
    row.visibleInStudentPortal === false ||
    !STUDENT_VISIBLE.includes(row.visibility as RegistrationVisibility)
  );
}

export function isHiddenFromTeacherPortal(row: RegistrationVisibilityFields): boolean {
  return (
    isOfficeOnlyVisibility(row.visibility) ||
    isRestrictedInternalRegistrationType(row.registrationType) ||
    isExternalRegistrationType(row.registrationType) ||
    !isStudentVisibleRegistrationType(row.registrationType) ||
    row.visibleToTeacher === false ||
    row.visibleInTeacherPortal === false ||
    !TEACHER_VISIBLE.includes(row.visibility as RegistrationVisibility)
  );
}

export function matchesStudentVisibleRegistration(row: RegistrationVisibilityFields): boolean {
  if (row.status && row.status !== "ACTIVE" && row.status !== "LOCKED") {
    return false;
  }
  return !isHiddenFromStudentPortal(row);
}

export function matchesTeacherVisibleRegistration(row: RegistrationVisibilityFields): boolean {
  if (row.status && row.status !== "ACTIVE" && row.status !== "LOCKED") {
    return false;
  }
  return !isHiddenFromTeacherPortal(row);
}

export function matchesTeacherAssignment(
  row: Pick<RegistrationVisibilityFields, "subjectId" | "gradeSnapshot" | "classNameSnapshot">,
  scope: TeacherRegistrationScope,
): boolean {
  if (scope.subjectIds.length === 0) return false;
  if (!row.subjectId || !scope.subjectIds.includes(row.subjectId)) return false;
  if (scope.visibleGrades.length > 0 && !scope.visibleGrades.includes(row.gradeSnapshot ?? "")) {
    return false;
  }
  if (scope.visibleClasses.length > 0 && !scope.visibleClasses.includes(row.classNameSnapshot ?? "")) {
    return false;
  }
  return true;
}

export function canStudentViewRegistration(row: RegistrationVisibilityFields): boolean {
  return matchesStudentVisibleRegistration(row);
}

export function canTeacherViewRegistration(
  row: RegistrationVisibilityFields,
  scope: TeacherRegistrationScope,
): boolean {
  return matchesTeacherVisibleRegistration(row) && matchesTeacherAssignment(row, scope);
}

export function canRoleViewRegistration(
  role: UserRole,
  row: RegistrationVisibilityFields,
  scope?: TeacherRegistrationScope,
): boolean {
  if (role === "ADMIN" || role === "EXAM_OFFICER") return true;
  if (role === "STUDENT") return canStudentViewRegistration(row);
  if (role === "SUBJECT_TEACHER") {
    return scope ? canTeacherViewRegistration(row, scope) : matchesTeacherVisibleRegistration(row);
  }
  return false;
}

export async function loadTeacherRegistrationScope(
  teacherId: string,
): Promise<TeacherRegistrationScope> {
  const [assignments, profile] = await Promise.all([
    prisma.teacherAssignment.findMany({
      where: { teacherId },
      select: { subjectId: true },
    }),
    prisma.teacherProfile.findUnique({
      where: { userId: teacherId },
      select: { visibleGrades: true, visibleClasses: true },
    }),
  ]);

  return {
    subjectIds: assignments.map((assignment) => assignment.subjectId),
    visibleGrades: parseJsonStringArray(profile?.visibleGrades),
    visibleClasses: parseJsonStringArray(profile?.visibleClasses),
  };
}

export function buildTeacherAssignmentWhere(
  scope: TeacherRegistrationScope,
): Prisma.StudentExamRegistrationWhereInput {
  if (scope.subjectIds.length === 0) {
    return { id: { in: [] } };
  }

  const and: Prisma.StudentExamRegistrationWhereInput[] = [
    { subjectId: { in: scope.subjectIds } },
  ];

  if (scope.visibleGrades.length > 0) {
    and.push({ gradeSnapshot: { in: scope.visibleGrades } });
  }
  if (scope.visibleClasses.length > 0) {
    and.push({ classNameSnapshot: { in: scope.visibleClasses } });
  }

  return { AND: and };
}

export async function buildTeacherRegistrationWhereForTeacher(
  base: Prisma.StudentExamRegistrationWhereInput,
  teacherId: string,
): Promise<Prisma.StudentExamRegistrationWhereInput> {
  const scope = await loadTeacherRegistrationScope(teacherId);
  return {
    AND: [base, buildTeacherAssignmentWhere(scope)],
  };
}

export async function teacherCanViewWorkspace(
  workspaceId: string,
  teacherId: string,
): Promise<boolean> {
  const [scope, workspace] = await Promise.all([
    loadTeacherRegistrationScope(teacherId),
    prisma.registrationWorkspace.findUnique({
      where: { id: workspaceId },
      select: {
        registrationType: true,
        visibility: true,
        visibleToTeacher: true,
        visibleInTeacherPortal: true,
        registrations: {
          where: { status: { in: ["ACTIVE", "LOCKED"] } },
          select: {
            registrationType: true,
            visibility: true,
            visibleToTeacher: true,
            visibleInTeacherPortal: true,
            subjectId: true,
            gradeSnapshot: true,
            classNameSnapshot: true,
            status: true,
          },
        },
      },
    }),
  ]);

  if (!workspace) return false;

  const workspaceRow: RegistrationVisibilityFields = {
    registrationType: workspace.registrationType,
    visibility: workspace.visibility,
    visibleToTeacher: workspace.visibleToTeacher,
    visibleInTeacherPortal: workspace.visibleInTeacherPortal,
  };

  if (isHiddenFromTeacherPortal(workspaceRow)) return false;

  return workspace.registrations.some((registration) =>
    canTeacherViewRegistration(
      {
        ...registration,
        registrationType: registration.registrationType ?? workspace.registrationType,
        visibility: registration.visibility ?? workspace.visibility,
      },
      scope,
    ),
  );
}
