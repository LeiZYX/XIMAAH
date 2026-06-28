import type { Prisma } from "@/generated/prisma/client";
import type { StudentProfileStatus } from "@/generated/prisma/enums";
import { RegistrationError } from "@/lib/registrations/errors";
import { syncCandidateFromStudentUser } from "@/lib/candidates/service";
import { prisma } from "@/lib/prisma";

export class StudentArchiveError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "StudentArchiveError";
  }
}

export type StudentStatusFilter = StudentProfileStatus | "ALL";

export function parseStudentStatusFilter(value: string | null | undefined): StudentStatusFilter {
  const normalized = (value ?? "ACTIVE").toUpperCase();
  if (
    normalized === "ACTIVE" ||
    normalized === "GRADUATED" ||
    normalized === "LEFT" ||
    normalized === "INACTIVE" ||
    normalized === "ALL"
  ) {
    return normalized;
  }
  return "ACTIVE";
}

export function buildStudentProfileWhere(
  status: StudentStatusFilter,
): Prisma.StudentProfileWhereInput {
  if (status === "ALL") return {};
  return { status };
}

export function buildActiveStudentUserWhere(): Prisma.UserWhereInput {
  return {
    role: "STUDENT",
    isActive: true,
    studentProfile: { status: "ACTIVE" },
  };
}

export async function assertStudentCanRegister(studentId: string): Promise<void> {
  const student = await prisma.user.findUnique({
    where: { id: studentId },
    include: { studentProfile: true },
  });

  if (!student || student.role !== "STUDENT") {
    throw new RegistrationError("Student account required", 403);
  }

  if (!student.isActive) {
    throw new RegistrationError(
      "This student account is archived and cannot create new registrations",
      403,
    );
  }

  if (!student.studentProfile || student.studentProfile.status !== "ACTIVE") {
    throw new RegistrationError("Only active students can create new registrations", 403);
  }
}

async function loadStudentOrThrow(studentId: string) {
  const student = await prisma.user.findUnique({
    where: { id: studentId },
    include: { studentProfile: true },
  });

  if (!student || student.role !== "STUDENT" || !student.studentProfile) {
    throw new StudentArchiveError("Student not found", 404);
  }

  return student;
}

export async function graduateStudent(studentId: string, graduationYear?: number) {
  const student = await loadStudentOrThrow(studentId);
  const now = new Date();
  const year = graduationYear ?? now.getFullYear();

  if (student.studentProfile!.status === "GRADUATED") {
    throw new StudentArchiveError("Student is already marked as graduated");
  }

  await prisma.$transaction([
    prisma.studentProfile.update({
      where: { userId: studentId },
      data: {
        status: "GRADUATED",
        graduationYear: year,
        graduatedAt: now,
        archivedAt: now,
      },
    }),
    prisma.user.update({
      where: { id: studentId },
      data: { isActive: false },
    }),
  ]);
  await syncCandidateFromStudentUser(studentId);
}

export async function leaveStudent(studentId: string) {
  const student = await loadStudentOrThrow(studentId);
  const now = new Date();

  if (student.studentProfile!.status === "LEFT") {
    throw new StudentArchiveError("Student is already marked as left");
  }

  await prisma.$transaction([
    prisma.studentProfile.update({
      where: { userId: studentId },
      data: {
        status: "LEFT",
        leftAt: now,
        archivedAt: now,
      },
    }),
    prisma.user.update({
      where: { id: studentId },
      data: { isActive: false },
    }),
  ]);
  await syncCandidateFromStudentUser(studentId);
}

export async function markStudentInactive(studentId: string) {
  const student = await loadStudentOrThrow(studentId);
  const now = new Date();

  await prisma.$transaction([
    prisma.studentProfile.update({
      where: { userId: studentId },
      data: {
        status: "INACTIVE",
        archivedAt: now,
      },
    }),
    prisma.user.update({
      where: { id: studentId },
      data: { isActive: false },
    }),
  ]);
  await syncCandidateFromStudentUser(studentId);
}

export async function reactivateStudent(studentId: string) {
  const student = await loadStudentOrThrow(studentId);

  await prisma.$transaction([
    prisma.studentProfile.update({
      where: { userId: studentId },
      data: {
        status: "ACTIVE",
        graduatedAt: null,
        leftAt: null,
        archivedAt: null,
      },
    }),
    prisma.user.update({
      where: { id: studentId },
      data: { isActive: true },
    }),
  ]);
  await syncCandidateFromStudentUser(studentId);
}
