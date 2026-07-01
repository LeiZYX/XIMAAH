/**
 * Backfill Candidate profile fields from linked User / StudentProfile records.
 *
 * Usage:
 *   npx tsx scripts/backfill-candidate-profile-fields.ts
 */
import { prisma } from "../src/lib/prisma";
import { generateStudentId } from "../src/lib/candidates/student-id";
import { parseGradeInput } from "../src/lib/students/profile-enums";

async function main() {
  const students = await prisma.user.findMany({
    where: { role: "STUDENT", studentProfile: { isNot: null } },
    include: { studentProfile: true, candidate: true },
  });

  let updated = 0;
  for (const student of students) {
    const profile = student.studentProfile;
    if (!profile) continue;

    const grade = parseGradeInput(profile.currentGrade) ?? profile.currentGrade;

    if (student.candidate) {
      await prisma.candidate.update({
        where: { id: student.candidate.id },
        data: {
          englishName: student.candidate.englishName || student.name,
          legalEnglishName: student.candidate.legalEnglishName ?? student.name,
          chineseName: student.candidate.chineseName,
          studentNumber: profile.studentNo,
          grade,
          className: profile.currentClassName,
          email: profile.email ?? student.email,
          phone: profile.phone ?? student.phone,
          gender: profile.gender ?? student.candidate.gender,
          idNumber: profile.idCardNumber ?? student.candidate.idNumber,
          idDocumentNumber: profile.idCardNumber ?? student.candidate.idDocumentNumber,
          status: profile.status,
          candidateType: "INTERNAL",
        },
      });
      updated += 1;
      continue;
    }

    await prisma.candidate.create({
      data: {
        studentId: await generateStudentId(),
        userId: student.id,
        candidateType: "INTERNAL",
        assessmentHubCandidateNumber: `AH-BACKFILL-${student.id.slice(-8).toUpperCase()}`,
        englishName: student.name,
        legalEnglishName: student.name,
        studentNumber: profile.studentNo,
        grade,
        className: profile.currentClassName,
        email: profile.email ?? student.email,
        phone: profile.phone ?? student.phone,
        gender: profile.gender,
        idNumber: profile.idCardNumber,
        idDocumentNumber: profile.idCardNumber,
        idDocumentType: profile.idCardNumber ? "CHINESE_ID_CARD" : null,
        status: profile.status,
        loginEnabled: student.isActive && profile.status === "ACTIVE",
        sourceSystem: "BACKFILL",
      },
    });
    updated += 1;
  }

  console.log(`Backfill complete. ${updated} candidate record(s) updated or created.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
