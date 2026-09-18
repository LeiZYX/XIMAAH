import { getSessionUser } from "@/lib/auth/session";
import type { StudentIdentityFields } from "@/lib/auth/student-identity";
import { prisma } from "@/lib/prisma";

export async function loadStudentPortalIdentity(
  userId: string,
): Promise<StudentIdentityFields | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      studentNo: true,
      studentProfile: {
        select: {
          studentNo: true,
          currentGrade: true,
          currentClassName: true,
        },
      },
      candidate: {
        select: {
          chineseName: true,
          preferredEnglishName: true,
          examIdentities: {
            select: {
              centreNumber: true,
              uciNumber: true,
              examBoard: { select: { code: true, centreNumber: true } },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });

  if (!user) return null;

  return {
    name: user.name,
    chineseName: user.candidate?.chineseName ?? null,
    preferredEnglishName: user.candidate?.preferredEnglishName ?? null,
    studentNo: user.studentProfile?.studentNo ?? user.studentNo ?? null,
    currentGrade: user.studentProfile?.currentGrade ?? null,
    currentClassName: user.studentProfile?.currentClassName ?? null,
    examIdentities: (user.candidate?.examIdentities ?? []).map((row) => ({
      boardCode: row.examBoard.code,
      centreNumber: row.centreNumber?.trim() || row.examBoard.centreNumber?.trim() || null,
      uciNumber: row.uciNumber?.trim() || null,
    })),
  };
}

export async function loadSessionStudentPortalIdentity(): Promise<StudentIdentityFields | null> {
  const session = await getSessionUser();
  if (!session) return null;
  return loadStudentPortalIdentity(session.id);
}
