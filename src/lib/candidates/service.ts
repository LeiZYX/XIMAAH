import type { Candidate, CandidateType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { computeDisplayName } from "@/lib/candidates/identity";
import { parseGenderInput } from "@/lib/candidates/export";

export function generateAssessmentHubCandidateNumber(): string {
  const year = new Date().getFullYear();
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `AH-${year}-${suffix}`;
}

export function candidateRegistrationSnapshots(candidate: Pick<
  Candidate,
  | "englishName"
  | "studentNumber"
  | "grade"
  | "className"
  | "email"
  | "phone"
  | "assessmentHubCandidateNumber"
  | "candidateType"
>) {
  const displayName = computeDisplayName(candidate);
  return {
    studentNameSnapshot: displayName || candidate.englishName,
    studentNoSnapshot: candidate.studentNumber ?? candidate.assessmentHubCandidateNumber,
    gradeSnapshot: candidate.grade ?? "—",
    classNameSnapshot: candidate.className ?? "—",
    emailSnapshot: candidate.email ?? null,
    phoneSnapshot: candidate.phone ?? null,
    assessmentHubCandidateNumberSnapshot: candidate.assessmentHubCandidateNumber,
    candidateTypeSnapshot: candidate.candidateType,
  };
}

export async function syncCandidateFromStudentUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { studentProfile: true, candidate: true },
  });
  if (!user?.studentProfile) return null;

  const profile = user.studentProfile;
  const loginEnabled = user.isActive && profile.status === "ACTIVE";

  if (user.candidate) {
    return prisma.candidate.update({
      where: { id: user.candidate.id },
      data: {
        englishName: computeDisplayName({
          preferredEnglishName: user.candidate.preferredEnglishName,
          legalEnglishName: user.candidate.legalEnglishName ?? user.name,
          englishName: user.name,
        }),
        legalEnglishName: user.candidate.legalEnglishName ?? user.name,
        studentNumber: profile.studentNo,
        email: profile.email ?? user.email,
        phone: profile.phone ?? user.phone,
        grade: profile.currentGrade,
        className: profile.currentClassName,
        graduationYear: profile.graduationYear,
        gender: profile.gender ?? user.candidate.gender,
        idDocumentNumber: profile.idCardNumber ?? user.candidate.idDocumentNumber,
        idDocumentType:
          profile.idCardNumber && !user.candidate.idDocumentType
            ? "CHINESE_ID_CARD"
            : user.candidate.idDocumentType,
        idNumber: profile.idCardNumber ?? user.candidate.idNumber,
        status: profile.status as "ACTIVE" | "GRADUATED" | "LEFT" | "INACTIVE",
        loginEnabled,
      },
    });
  }

  return prisma.candidate.create({
    data: {
      userId: user.id,
      candidateType: "INTERNAL",
      assessmentHubCandidateNumber: generateAssessmentHubCandidateNumber(),
      englishName: user.name,
      legalEnglishName: user.name,
      studentNumber: profile.studentNo,
      email: profile.email ?? user.email,
      phone: profile.phone ?? user.phone,
      grade: profile.currentGrade,
      className: profile.currentClassName,
      graduationYear: profile.graduationYear,
      gender: profile.gender,
      idDocumentNumber: profile.idCardNumber,
      idDocumentType: profile.idCardNumber ? "CHINESE_ID_CARD" : null,
      idNumber: profile.idCardNumber,
      status: profile.status as "ACTIVE" | "GRADUATED" | "LEFT" | "INACTIVE",
      loginEnabled,
      sourceSystem: "STUDENT_PROFILE",
    },
  });
}

export async function ensureInternalCandidatesSynced() {
  const [studentCount, linkedCount] = await Promise.all([
    prisma.user.count({ where: { role: "STUDENT", studentProfile: { isNot: null } } }),
    prisma.candidate.count({ where: { candidateType: "INTERNAL", userId: { not: null } } }),
  ]);

  if (studentCount > linkedCount) {
    await backfillCandidatesFromStudents();
  }
}

export async function backfillCandidatesFromStudents() {
  const students = await prisma.user.findMany({
    where: { role: "STUDENT", studentProfile: { isNot: null } },
    select: { id: true },
  });

  let created = 0;
  for (const student of students) {
    const existing = await prisma.candidate.findUnique({ where: { userId: student.id } });
    if (!existing) {
      await syncCandidateFromStudentUser(student.id);
      created += 1;
    }
  }

  await backfillRegistrationCandidateIds();
  return { processed: students.length, created };
}

export async function backfillRegistrationCandidateIds() {
  const workspaces = await prisma.registrationWorkspace.findMany({
    where: { candidateId: null, studentId: { not: null } },
    select: { id: true, studentId: true },
  });

  for (const workspace of workspaces) {
    if (!workspace.studentId) continue;
    const candidate = await syncCandidateFromStudentUser(workspace.studentId);
    if (!candidate) continue;
    await prisma.registrationWorkspace.update({
      where: { id: workspace.id },
      data: { candidateId: candidate.id },
    });
    await prisma.studentExamRegistration.updateMany({
      where: { registrationWorkspaceId: workspace.id },
      data: {
        candidateId: candidate.id,
        assessmentHubCandidateNumberSnapshot: candidate.assessmentHubCandidateNumber,
        candidateTypeSnapshot: candidate.candidateType,
      },
    });
  }

  const orphanRegs = await prisma.studentExamRegistration.findMany({
    where: { candidateId: null, studentId: { not: null } },
    select: { id: true, studentId: true },
    distinct: ["studentId"],
  });

  for (const row of orphanRegs) {
    if (!row.studentId) continue;
    const candidate = await syncCandidateFromStudentUser(row.studentId);
    if (!candidate) continue;
    await prisma.studentExamRegistration.updateMany({
      where: { studentId: row.studentId, candidateId: null },
      data: {
        candidateId: candidate.id,
        assessmentHubCandidateNumberSnapshot: candidate.assessmentHubCandidateNumber,
        candidateTypeSnapshot: candidate.candidateType,
      },
    });
  }
}

export async function resolveCandidateForRegistration(params: {
  candidateId?: string;
  studentId?: string;
}) {
  if (params.candidateId) {
    const candidate = await prisma.candidate.findUnique({ where: { id: params.candidateId } });
    if (!candidate) throw new Error("Candidate not found");
    return candidate;
  }
  if (params.studentId) {
    const candidate = await syncCandidateFromStudentUser(params.studentId);
    if (!candidate) throw new Error("Could not resolve internal candidate");
    return candidate;
  }
  throw new Error("Candidate or student is required");
}

export async function createExternalCandidate(input: {
  chineseName?: string | null;
  surnamePinyin?: string | null;
  givenNamePinyin?: string | null;
  preferredEnglishName?: string | null;
  legalEnglishName?: string | null;
  englishName?: string | null;
  email?: string | null;
  phone?: string | null;
  dateOfBirth?: Date | null;
  gender?: Candidate["gender"] | string | null;
  nationality?: string | null;
  idDocumentType?: Candidate["idDocumentType"];
  idDocumentNumber?: string | null;
  idNumber?: string | null;
  passportNumber?: string | null;
  schoolName?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  assessmentHubCandidateNumber?: string | null;
  externalId?: string | null;
}) {
  const legalEnglishName = input.legalEnglishName?.trim() || input.englishName?.trim() || "";
  const displayName = computeDisplayName({
    preferredEnglishName: input.preferredEnglishName,
    legalEnglishName,
  });

  return prisma.candidate.create({
    data: {
      candidateType: "EXTERNAL",
      assessmentHubCandidateNumber:
        input.assessmentHubCandidateNumber?.trim() || generateAssessmentHubCandidateNumber(),
      chineseName: input.chineseName?.trim() || null,
      surnamePinyin: input.surnamePinyin?.trim() || null,
      givenNamePinyin: input.givenNamePinyin?.trim() || null,
      preferredEnglishName: input.preferredEnglishName?.trim() || null,
      legalEnglishName: legalEnglishName || null,
      englishName: displayName || legalEnglishName,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      dateOfBirth: input.dateOfBirth ?? null,
      gender: parseGenderInput(typeof input.gender === "string" ? input.gender : undefined) ?? (input.gender as Candidate["gender"]) ?? null,
      nationality: input.nationality?.trim() || null,
      idDocumentType: input.idDocumentType ?? null,
      idDocumentNumber: input.idDocumentNumber?.trim() || null,
      idNumber: input.idNumber?.trim() || null,
      passportNumber: input.passportNumber?.trim() || null,
      schoolName: input.schoolName?.trim() || null,
      emergencyContactName: input.emergencyContactName?.trim() || null,
      emergencyContactPhone: input.emergencyContactPhone?.trim() || null,
      loginEnabled: false,
      status: "ACTIVE",
      sourceSystem: "MANUAL",
      externalId: input.externalId?.trim() || null,
    },
  });
}

export function isInternalCandidate(type: CandidateType): boolean {
  return type === "INTERNAL";
}
