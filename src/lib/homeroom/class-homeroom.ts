import type { Grade } from "@/generated/prisma/enums";
import { UserRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { RegistrationError } from "@/lib/registrations/errors";

export const NO_HOMEROOM_TEACHER_MESSAGE =
  "本班尚未配置班主任，请联系考务";

export function normalizeClassName(className: string): string {
  return className.trim();
}

export async function findHomeroomTeacherForClass(grade: Grade, className: string) {
  const normalized = normalizeClassName(className);
  if (!normalized) return null;
  return prisma.classHomeroomTeacher.findUnique({
    where: {
      grade_className: { grade, className: normalized },
    },
    include: {
      teacher: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          teacherProfile: { select: { email: true, status: true } },
        },
      },
    },
  });
}

export async function requireHomeroomTeacherForStudent(studentId: string) {
  const profile = await prisma.studentProfile.findUnique({
    where: { userId: studentId },
    select: { currentGrade: true, currentClassName: true },
  });
  if (!profile?.currentClassName?.trim()) {
    throw new RegistrationError(NO_HOMEROOM_TEACHER_MESSAGE, 400);
  }

  const assignment = await findHomeroomTeacherForClass(
    profile.currentGrade,
    profile.currentClassName,
  );
  if (!assignment || !assignment.teacher.isActive || assignment.teacher.role !== UserRole.SUBJECT_TEACHER) {
    throw new RegistrationError(NO_HOMEROOM_TEACHER_MESSAGE, 400);
  }

  return {
    grade: profile.currentGrade,
    className: normalizeClassName(profile.currentClassName),
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
