import type { Grade } from "@/generated/prisma/enums";
import { UserRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { RegistrationError } from "@/lib/registrations/errors";

export const NO_HOMEROOM_TEACHER_MESSAGE =
  "本班尚未配置班主任，请联系考务";

export const NO_STUDENT_CLASS_MESSAGE =
  "学生档案未填写班级，请先联系考务完善年级/班级后再提交";

const homeroomTeacherSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  teacherProfile: { select: { email: true, status: true } },
} as const;

/** Canonical class label for storage/lookup (e.g. "Class 1" / "1班" → "1"). */
export function normalizeClassName(className: string): string {
  let value = className.trim().replace(/\s+/g, " ");
  if (!value) return "";
  value = value.replace(/^(class|班级)\s*/i, "").trim();
  value = value.replace(/班$/u, "").trim();
  return value.replace(/\s+/g, " ");
}

/** Case-insensitive match key so "G5" and "g5" hit the same assignment. */
export function classNameMatchKey(className: string): string {
  return normalizeClassName(className).toLowerCase();
}

function gradeLabel(grade: Grade): string {
  return String(grade).replace(/^G/, "G");
}

export async function findHomeroomTeacherForClass(grade: Grade, className: string) {
  const key = classNameMatchKey(className);
  if (!key) return null;

  const normalized = normalizeClassName(className);
  const exact = await prisma.classHomeroomTeacher.findUnique({
    where: {
      grade_className: { grade, className: normalized },
    },
    include: { teacher: { select: homeroomTeacherSelect } },
  });
  if (exact) return exact;

  // Fall back: match aliases already stored in the table (e.g. "Class 1" vs "1").
  const rows = await prisma.classHomeroomTeacher.findMany({
    where: { grade },
    include: { teacher: { select: homeroomTeacherSelect } },
  });
  return rows.find((row) => classNameMatchKey(row.className) === key) ?? null;
}

export async function requireHomeroomTeacherForStudent(studentId: string) {
  const profile = await prisma.studentProfile.findUnique({
    where: { userId: studentId },
    select: { currentGrade: true, currentClassName: true },
  });
  if (!profile?.currentGrade) {
    throw new RegistrationError(
      "学生档案未填写年级，请先联系考务完善年级/班级后再提交",
      400,
    );
  }
  if (!profile.currentClassName?.trim()) {
    throw new RegistrationError(NO_STUDENT_CLASS_MESSAGE, 400);
  }

  const className = normalizeClassName(profile.currentClassName);
  const classAssignment = await findHomeroomTeacherForClass(profile.currentGrade, className);
  const gradeAssignments = await prisma.classHomeroomTeacher.findMany({
    where: { grade: profile.currentGrade },
    include: { teacher: { select: homeroomTeacherSelect } },
    orderBy: [{ className: "asc" }],
  });

  const usable = (row: (typeof gradeAssignments)[number] | null | undefined) =>
    Boolean(
      row &&
        row.teacher.isActive &&
        row.teacher.role === UserRole.SUBJECT_TEACHER,
    );

  const assignment =
    (usable(classAssignment) ? classAssignment : null) ??
    gradeAssignments.find((row) => usable(row)) ??
    null;

  if (!assignment) {
    throw new RegistrationError(
      `${gradeLabel(profile.currentGrade)} 尚未配置任何班主任，请联系考务在 Class form teachers 中至少配置一位同年级班主任`,
      400,
    );
  }

  return {
    grade: profile.currentGrade,
    // Keep the student's own class on the request snapshot, even when routing
    // falls back to another same-grade form teacher.
    className,
    teacher: assignment.teacher,
    assignmentId: assignment.id,
  };
}

export async function listHomeroomTeachersForGrade(grade: Grade) {
  return prisma.classHomeroomTeacher.findMany({
    where: { grade },
    include: {
      teacher: {
        select: {
          id: true,
          name: true,
          email: true,
          isActive: true,
          teacherProfile: { select: { email: true } },
        },
      },
    },
    orderBy: [{ className: "asc" }],
  });
}

export async function teacherCanReviewStudentAdjustment(params: {
  teacherId: string;
  studentGrade: Grade | null | undefined;
  primaryHomeroomTeacherId: string | null | undefined;
}): Promise<boolean> {
  if (params.primaryHomeroomTeacherId && params.primaryHomeroomTeacherId === params.teacherId) {
    return true;
  }
  if (!params.studentGrade) return false;
  const row = await prisma.classHomeroomTeacher.findFirst({
    where: {
      grade: params.studentGrade,
      teacherUserId: params.teacherId,
    },
    select: { id: true },
  });
  return Boolean(row);
}

export async function listClassHomeroomTeachers() {
  return prisma.classHomeroomTeacher.findMany({
    include: {
      teacher: {
        select: {
          id: true,
          name: true,
          email: true,
          username: true,
          isActive: true,
          teacherProfile: { select: { email: true, status: true } },
        },
      },
    },
    orderBy: [{ grade: "asc" }, { className: "asc" }],
  });
}

export async function upsertClassHomeroomTeacher(input: {
  grade: Grade;
  className: string;
  teacherUserId: string;
}) {
  const className = normalizeClassName(input.className);
  if (!className) {
    throw new RegistrationError("Class name is required", 400);
  }

  const teacher = await prisma.user.findUnique({
    where: { id: input.teacherUserId },
    select: { id: true, role: true, isActive: true },
  });
  if (!teacher || teacher.role !== UserRole.SUBJECT_TEACHER || !teacher.isActive) {
    throw new RegistrationError("Select an active subject teacher", 400);
  }

  // Prefer updating an existing alias row for the same grade+class key.
  const existing = await findHomeroomTeacherForClass(input.grade, className);
  if (existing && classNameMatchKey(existing.className) === classNameMatchKey(className)) {
    return prisma.classHomeroomTeacher.update({
      where: { id: existing.id },
      data: {
        className,
        teacherUserId: input.teacherUserId,
      },
      include: {
        teacher: {
          select: {
            id: true,
            name: true,
            email: true,
            username: true,
            isActive: true,
          },
        },
      },
    });
  }

  return prisma.classHomeroomTeacher.upsert({
    where: {
      grade_className: { grade: input.grade, className },
    },
    create: {
      grade: input.grade,
      className,
      teacherUserId: input.teacherUserId,
    },
    update: {
      teacherUserId: input.teacherUserId,
    },
    include: {
      teacher: {
        select: {
          id: true,
          name: true,
          email: true,
          username: true,
          isActive: true,
        },
      },
    },
  });
}

export async function deleteClassHomeroomTeacher(id: string) {
  await prisma.classHomeroomTeacher.delete({ where: { id } });
}

export function resolveTeacherEmail(teacher: {
  email?: string | null;
  teacherProfile?: { email?: string | null } | null;
}): string | null {
  return teacher.email?.trim() || teacher.teacherProfile?.email?.trim() || null;
}
