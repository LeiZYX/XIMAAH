import "dotenv/config";
import { hashPassword } from "../src/lib/auth/password";
import { syncCandidateFromStudentUser } from "../src/lib/candidates/service";
import { exitAfterPrismaScript, prisma } from "../src/lib/prisma";

const TEST_PASSWORD = "password123";

const TEST_STUDENTS = [
  {
    studentNo: "S2026001",
    name: "Sample Student",
    email: "student@xima.local",
    phone: "+8613800000002",
    currentGrade: "G12" as const,
    currentClassName: "12A",
    entryYear: 2024,
  },
  {
    studentNo: "S2026002",
    name: "Test Student Two",
    email: "student2@xima.local",
    phone: "+8613800000003",
    currentGrade: "G11" as const,
    currentClassName: "11B",
    entryYear: 2025,
  },
];

async function upsertTestStudent(student: (typeof TEST_STUDENTS)[number]) {
  const passwordHash = await hashPassword(TEST_PASSWORD);

  const user = await prisma.user.upsert({
    where: { studentNo: student.studentNo },
    update: {
      name: student.name,
      email: student.email,
      phone: student.phone,
      passwordHash,
      role: "STUDENT",
      isActive: true,
      mustChangePassword: false,
    },
    create: {
      studentNo: student.studentNo,
      name: student.name,
      email: student.email,
      phone: student.phone,
      passwordHash,
      role: "STUDENT",
      isActive: true,
      mustChangePassword: false,
    },
  });

  await prisma.studentProfile.upsert({
    where: { userId: user.id },
    update: {
      studentNo: student.studentNo,
      currentGrade: student.currentGrade,
      currentClassName: student.currentClassName,
      email: student.email,
      phone: student.phone,
      status: "ACTIVE",
      entryYear: student.entryYear,
    },
    create: {
      userId: user.id,
      studentNo: student.studentNo,
      currentGrade: student.currentGrade,
      currentClassName: student.currentClassName,
      email: student.email,
      phone: student.phone,
      status: "ACTIVE",
      entryYear: student.entryYear,
    },
  });

  await syncCandidateFromStudentUser(user.id);
  return user;
}

async function main() {
  for (const student of TEST_STUDENTS) {
    await upsertTestStudent(student);
  }

  console.log("Created/updated 2 test student accounts:");
  console.log("  Student 1: S2026001 or student@xima.local — password123 (G12 · 12A)");
  console.log("  Student 2: S2026002 or student2@xima.local — password123 (G11 · 11B)");
  await exitAfterPrismaScript(prisma, 0);
}

main().catch(async (error) => {
  console.error(error);
  await exitAfterPrismaScript(prisma, 1);
});
