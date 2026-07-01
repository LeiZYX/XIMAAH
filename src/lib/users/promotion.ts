import type { Grade, StudentProfileStatus } from "@/generated/prisma/enums";
import { syncCandidateFromStudentUser } from "@/lib/candidates/service";
import { logUserAudit } from "@/lib/users/audit";
import { prisma } from "@/lib/prisma";
import { parseGradeInput } from "@/lib/students/profile-enums";

export interface PromotionPreviewInput {
  sourceGrade: Grade | string;
  sourceClassName?: string;
  targetGrade?: Grade | string;
  targetClassName?: string;
  archiveStatus?: StudentProfileStatus;
}

function resolveGrade(value: Grade | string | undefined): Grade | undefined {
  if (!value) return undefined;
  return typeof value === "string" ? parseGradeInput(value) : value;
}

export async function previewClassPromotion(input: PromotionPreviewInput) {
  const sourceGrade = resolveGrade(input.sourceGrade);
  if (!sourceGrade) throw new Error("sourceGrade must be one of G9, G10, G11, G12");

  const students = await prisma.user.findMany({
    where: {
      role: "STUDENT",
      studentProfile: {
        is: {
          currentGrade: sourceGrade,
          ...(input.sourceClassName ? { currentClassName: input.sourceClassName } : {}),
          status: "ACTIVE",
        },
      },
    },
    include: { studentProfile: true, candidate: true },
    orderBy: [{ name: "asc" }],
  });

  return students.map((student) => ({
    id: student.id,
    name: student.name,
    studentNo: student.studentProfile?.studentNo ?? null,
    currentGrade: student.studentProfile?.currentGrade ?? null,
    currentClassName: student.studentProfile?.currentClassName ?? null,
    targetGrade: resolveGrade(input.targetGrade) ?? student.studentProfile?.currentGrade ?? null,
    targetClassName: input.targetClassName ?? student.studentProfile?.currentClassName ?? null,
    archiveStatus: input.archiveStatus ?? null,
  }));
}

export async function commitClassPromotion(
  performedById: string,
  input: PromotionPreviewInput & { studentIds: string[] },
) {
  const sourceGrade = resolveGrade(input.sourceGrade);
  if (!sourceGrade) throw new Error("sourceGrade must be one of G9, G10, G11, G12");

  const students = await prisma.user.findMany({
    where: {
      id: { in: input.studentIds },
      role: "STUDENT",
      studentProfile: {
        is: {
          currentGrade: sourceGrade,
          ...(input.sourceClassName ? { currentClassName: input.sourceClassName } : {}),
        },
      },
    },
    include: { studentProfile: true },
  });

  if (students.length !== input.studentIds.length) {
    throw new Error("One or more students are not eligible for this promotion");
  }

  for (const student of students) {
    const profile = student.studentProfile;
    if (!profile) continue;

    const nextStatus = input.archiveStatus ?? profile.status;
    const nextGrade = resolveGrade(input.targetGrade) ?? profile.currentGrade;
    const nextClass = input.targetClassName ?? profile.currentClassName;

    await prisma.studentProfile.update({
      where: { id: profile.id },
      data: {
        currentGrade: nextGrade,
        currentClassName: nextClass,
        status: nextStatus,
        ...(nextStatus === "GRADUATED"
          ? { graduatedAt: new Date(), graduationYear: new Date().getFullYear() }
          : {}),
        ...(nextStatus === "LEFT" ? { leftAt: new Date() } : {}),
        ...(nextStatus === "INACTIVE" ? { archivedAt: new Date() } : {}),
      },
    });

    if (!student.isActive && nextStatus === "ACTIVE") {
      await prisma.user.update({
        where: { id: student.id },
        data: { isActive: true },
      });
    }

    await syncCandidateFromStudentUser(student.id);

    await logUserAudit({
      action: nextStatus === "GRADUATED" || nextStatus === "INACTIVE" ? "STUDENT_ARCHIVED" : "STUDENT_PROMOTED",
      performedById,
      targetUserId: student.id,
      metadata: {
        fromGrade: profile.currentGrade,
        fromClass: profile.currentClassName,
        toGrade: nextGrade,
        toClass: nextClass,
        status: nextStatus,
      },
    });
  }

  return { updated: students.length };
}
