import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/auth/password";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const adminEmail = (process.env.ADMIN_EMAIL ?? "admin@xima.local").toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD ?? "admin123";
  const adminName = process.env.ADMIN_NAME ?? "Admin";

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: adminName,
      username: "admin",
      passwordHash: await hashPassword(adminPassword),
      role: "ADMIN",
      isActive: true,
      mustChangePassword: false,
    },
    create: {
      email: adminEmail,
      username: "admin",
      name: adminName,
      passwordHash: await hashPassword(adminPassword),
      role: "ADMIN",
      isActive: true,
      mustChangePassword: false,
    },
  });

  const aqa = await prisma.examBoard.upsert({
    where: { code: "AQA" },
    update: {
      name: "Assessment and Qualifications Alliance",
      country: "GB",
      region: "United Kingdom",
      timezone: "Europe/London",
    },
    create: {
      name: "Assessment and Qualifications Alliance",
      code: "AQA",
      description: "Leading exam board for GCSEs and A-Levels in England",
      country: "GB",
      region: "United Kingdom",
      timezone: "Europe/London",
      website: "https://www.aqa.org.uk",
    },
  });

  const cie = await prisma.examBoard.upsert({
    where: { code: "CIE" },
    update: {
      name: "Cambridge International Examinations",
      country: "GB",
      region: "International",
      timezone: "Europe/London",
    },
    create: {
      name: "Cambridge International Examinations",
      code: "CIE",
      description: "Cambridge Assessment International Education (IGCSE, AS & A Level)",
      country: "GB",
      region: "International",
      timezone: "Europe/London",
      website: "https://www.cambridgeinternational.org",
    },
  });

  const edexcel = await prisma.examBoard.upsert({
    where: { code: "EDEXCEL" },
    update: {
      name: "Edexcel (Pearson)",
      country: "GB",
      region: "United Kingdom",
      timezone: "Europe/London",
    },
    create: {
      name: "Edexcel (Pearson)",
      code: "EDEXCEL",
      description: "Pearson Edexcel qualifications",
      country: "GB",
      region: "United Kingdom",
      timezone: "Europe/London",
      website: "https://qualifications.pearson.com",
    },
  });

  // Legacy seed used code "EDX" — remove duplicate if present
  await prisma.examBoard.deleteMany({ where: { code: "EDX" } });

  const gcseMathsAqa = await prisma.qualification.upsert({
    where: { id: "seed-qual-aqa-gcse-maths" },
    update: {},
    create: {
      id: "seed-qual-aqa-gcse-maths",
      name: "GCSE Mathematics",
      level: "GCSE",
      code: "8300",
      examBoardId: aqa.id,
    },
  });

  const aLevelPhysicsAqa = await prisma.qualification.upsert({
    where: { id: "seed-qual-aqa-alevel-physics" },
    update: {},
    create: {
      id: "seed-qual-aqa-alevel-physics",
      name: "A-Level Physics",
      level: "A-Level",
      code: "7408",
      examBoardId: aqa.id,
    },
  });

  const igcseMathsCie = await prisma.qualification.upsert({
    where: { id: "seed-qual-cie-igcse-maths" },
    update: {},
    create: {
      id: "seed-qual-cie-igcse-maths",
      name: "IGCSE Mathematics",
      level: "IGCSE",
      code: "0580",
      examBoardId: cie.id,
    },
  });

  const gcseMathsEdexcel = await prisma.qualification.upsert({
    where: { id: "seed-qual-edexcel-gcse-maths" },
    update: {},
    create: {
      id: "seed-qual-edexcel-gcse-maths",
      name: "GCSE Mathematics",
      level: "GCSE",
      code: "1MA1",
      examBoardId: edexcel.id,
    },
  });

  const mathsSubjectAqa = await prisma.subject.upsert({
    where: { id: "seed-subject-aqa-maths" },
    update: {},
    create: {
      id: "seed-subject-aqa-maths",
      name: "Mathematics",
      code: "8300",
      qualificationId: gcseMathsAqa.id,
    },
  });

  const physicsSubjectAqa = await prisma.subject.upsert({
    where: { id: "seed-subject-aqa-physics" },
    update: {},
    create: {
      id: "seed-subject-aqa-physics",
      name: "Physics",
      code: "7408",
      qualificationId: aLevelPhysicsAqa.id,
    },
  });

  const mathsSubjectCie = await prisma.subject.upsert({
    where: { id: "seed-subject-cie-maths" },
    update: {},
    create: {
      id: "seed-subject-cie-maths",
      name: "Mathematics",
      code: "0580",
      qualificationId: igcseMathsCie.id,
    },
  });

  const mathsSubjectEdexcel = await prisma.subject.upsert({
    where: { id: "seed-subject-edexcel-maths" },
    update: {},
    create: {
      id: "seed-subject-edexcel-maths",
      name: "Mathematics",
      code: "1MA1",
      qualificationId: gcseMathsEdexcel.id,
    },
  });

  const aqaPaper1 = await prisma.paper.upsert({
    where: { id: "seed-paper-aqa-maths-1" },
    update: {},
    create: {
      id: "seed-paper-aqa-maths-1",
      code: "8300/1F",
      title: "Paper 1 Foundation",
      duration: 90,
      subjectId: mathsSubjectAqa.id,
    },
  });

  const aqaPaper2 = await prisma.paper.upsert({
    where: { id: "seed-paper-aqa-maths-2" },
    update: {},
    create: {
      id: "seed-paper-aqa-maths-2",
      code: "8300/2F",
      title: "Paper 2 Foundation",
      duration: 90,
      subjectId: mathsSubjectAqa.id,
    },
  });

  const aqaPhysicsPaper = await prisma.paper.upsert({
    where: { id: "seed-paper-aqa-physics-1" },
    update: {},
    create: {
      id: "seed-paper-aqa-physics-1",
      code: "7408/1",
      title: "Paper 1",
      duration: 120,
      subjectId: physicsSubjectAqa.id,
    },
  });

  const ciePaper1 = await prisma.paper.upsert({
    where: { id: "seed-paper-cie-maths-1" },
    update: {},
    create: {
      id: "seed-paper-cie-maths-1",
      code: "0580/21",
      title: "Paper 2 (Extended)",
      duration: 120,
      subjectId: mathsSubjectCie.id,
    },
  });

  const edexcelPaper1 = await prisma.paper.upsert({
    where: { id: "seed-paper-edexcel-maths-1" },
    update: {},
    create: {
      id: "seed-paper-edexcel-maths-1",
      code: "1MA1/1F",
      title: "Paper 1 Foundation (Non-Calculator)",
      duration: 90,
      subjectId: mathsSubjectEdexcel.id,
    },
  });

  const aqaSummer2026 = await prisma.examSeries.upsert({
    where: { id: "seed-series-aqa-summer-2026" },
    update: {},
    create: {
      id: "seed-series-aqa-summer-2026",
      name: "Summer 2026",
      year: 2026,
      examBoardId: aqa.id,
      startDate: new Date("2026-05-11"),
      endDate: new Date("2026-06-26"),
    },
  });

  const cieJune2026 = await prisma.examSeries.upsert({
    where: { id: "seed-series-cie-june-2026" },
    update: {},
    create: {
      id: "seed-series-cie-june-2026",
      name: "June 2026",
      year: 2026,
      examBoardId: cie.id,
      startDate: new Date("2026-04-28"),
      endDate: new Date("2026-06-12"),
    },
  });

  const edexcelSummer2026 = await prisma.examSeries.upsert({
    where: { id: "seed-series-edexcel-summer-2026" },
    update: {},
    create: {
      id: "seed-series-edexcel-summer-2026",
      name: "Summer 2026",
      year: 2026,
      examBoardId: edexcel.id,
      startDate: new Date("2026-05-11"),
      endDate: new Date("2026-06-26"),
    },
  });

  await prisma.examSession.upsert({
    where: { id: "seed-session-aqa-maths-1" },
    update: {},
    create: {
      id: "seed-session-aqa-maths-1",
      date: new Date("2026-05-19T09:00:00"),
      startTime: "09:00",
      endTime: "10:30",
      venue: "Main Hall",
      paperId: aqaPaper1.id,
      examSeriesId: aqaSummer2026.id,
    },
  });

  await prisma.examSession.upsert({
    where: { id: "seed-session-aqa-maths-2" },
    update: {},
    create: {
      id: "seed-session-aqa-maths-2",
      date: new Date("2026-06-04T13:00:00"),
      startTime: "13:00",
      endTime: "14:30",
      venue: "Sports Hall",
      paperId: aqaPaper2.id,
      examSeriesId: aqaSummer2026.id,
    },
  });

  await prisma.examSession.upsert({
    where: { id: "seed-session-aqa-physics-1" },
    update: {},
    create: {
      id: "seed-session-aqa-physics-1",
      date: new Date("2026-06-12T09:00:00"),
      startTime: "09:00",
      endTime: "11:00",
      venue: "Lab Block",
      paperId: aqaPhysicsPaper.id,
      examSeriesId: aqaSummer2026.id,
    },
  });

  await prisma.examSession.upsert({
    where: { id: "seed-session-cie-maths-1" },
    update: {},
    create: {
      id: "seed-session-cie-maths-1",
      date: new Date("2026-05-08T09:00:00"),
      startTime: "09:00",
      endTime: "11:00",
      venue: "Hall A",
      paperId: ciePaper1.id,
      examSeriesId: cieJune2026.id,
    },
  });

  await prisma.examSession.upsert({
    where: { id: "seed-session-edexcel-maths-1" },
    update: {},
    create: {
      id: "seed-session-edexcel-maths-1",
      date: new Date("2026-05-20T09:00:00"),
      startTime: "09:00",
      endTime: "10:30",
      venue: "Hall B",
      paperId: edexcelPaper1.id,
      examSeriesId: edexcelSummer2026.id,
    },
  });

  await prisma.keyDate.upsert({
    where: { id: "seed-keydate-aqa-entry" },
    update: {},
    create: {
      id: "seed-keydate-aqa-entry",
      title: "Final Entry Deadline",
      date: new Date("2026-02-21"),
      type: "DEADLINE",
      description: "Last date to submit candidate entries",
      examBoardId: aqa.id,
      examSeriesId: aqaSummer2026.id,
    },
  });

  await prisma.keyDate.upsert({
    where: { id: "seed-keydate-aqa-results" },
    update: {},
    create: {
      id: "seed-keydate-aqa-results",
      title: "GCSE Results Day",
      date: new Date("2026-08-20"),
      type: "RESULTS",
      description: "Results released to centres",
      examBoardId: aqa.id,
      examSeriesId: aqaSummer2026.id,
    },
  });

  await prisma.keyDate.upsert({
    where: { id: "seed-keydate-cie-entry" },
    update: {},
    create: {
      id: "seed-keydate-cie-entry",
      title: "Late Entry Deadline",
      date: new Date("2026-03-01"),
      type: "DEADLINE",
      description: "Final late entry date for June series",
      examBoardId: cie.id,
      examSeriesId: cieJune2026.id,
    },
  });

  await prisma.keyDate.upsert({
    where: { id: "seed-keydate-edexcel-results" },
    update: {},
    create: {
      id: "seed-keydate-edexcel-results",
      title: "Results Day",
      date: new Date("2026-08-20"),
      type: "RESULTS",
      description: "Summer results released",
      examBoardId: edexcel.id,
      examSeriesId: edexcelSummer2026.id,
    },
  });

  const examOfficer = await prisma.user.upsert({
    where: { username: "examofficer" },
    update: {
      name: "Exam Officer",
      email: "exam.officer@xima.local",
      passwordHash: await hashPassword("password123"),
      role: "EXAM_OFFICER",
      isActive: true,
      mustChangePassword: false,
    },
    create: {
      username: "examofficer",
      email: "exam.officer@xima.local",
      name: "Exam Officer",
      passwordHash: await hashPassword("password123"),
      role: "EXAM_OFFICER",
      isActive: true,
      mustChangePassword: false,
    },
  });

  const teacher = await prisma.user.upsert({
    where: { email: "teacher@xima.local" },
    update: {
      name: "Physics Teacher",
      phone: "+8613800000001",
      passwordHash: await hashPassword("password123"),
      role: "SUBJECT_TEACHER",
      isActive: true,
      mustChangePassword: false,
    },
    create: {
      email: "teacher@xima.local",
      phone: "+8613800000001",
      name: "Physics Teacher",
      passwordHash: await hashPassword("password123"),
      role: "SUBJECT_TEACHER",
      isActive: true,
      mustChangePassword: false,
    },
  });

  const student = await prisma.user.upsert({
    where: { studentNo: "S2026001" },
    update: {
      name: "Sample Student",
      email: "student@xima.local",
      phone: "+8613800000002",
      passwordHash: await hashPassword("password123"),
      role: "STUDENT",
      isActive: true,
      mustChangePassword: false,
    },
    create: {
      studentNo: "S2026001",
      name: "Sample Student",
      email: "student@xima.local",
      phone: "+8613800000002",
      passwordHash: await hashPassword("password123"),
      role: "STUDENT",
      isActive: true,
      mustChangePassword: false,
    },
  });

  await prisma.studentProfile.upsert({
    where: { userId: student.id },
    update: {
      studentNo: "S2026001",
      currentGrade: "Year 12",
      currentClassName: "12A",
      email: "student@xima.local",
      phone: "+8613800000002",
      status: "ACTIVE",
      entryYear: 2024,
    },
    create: {
      userId: student.id,
      studentNo: "S2026001",
      currentGrade: "Year 12",
      currentClassName: "12A",
      email: "student@xima.local",
      phone: "+8613800000002",
      status: "ACTIVE",
      entryYear: 2024,
    },
  });

  const studentTwo = await prisma.user.upsert({
    where: { studentNo: "S2026002" },
    update: {
      name: "Test Student Two",
      email: "student2@xima.local",
      phone: "+8613800000003",
      passwordHash: await hashPassword("password123"),
      role: "STUDENT",
      isActive: true,
      mustChangePassword: false,
    },
    create: {
      studentNo: "S2026002",
      name: "Test Student Two",
      email: "student2@xima.local",
      phone: "+8613800000003",
      passwordHash: await hashPassword("password123"),
      role: "STUDENT",
      isActive: true,
      mustChangePassword: false,
    },
  });

  await prisma.studentProfile.upsert({
    where: { userId: studentTwo.id },
    update: {
      studentNo: "S2026002",
      currentGrade: "Year 11",
      currentClassName: "11B",
      email: "student2@xima.local",
      phone: "+8613800000003",
      status: "ACTIVE",
      entryYear: 2025,
    },
    create: {
      userId: studentTwo.id,
      studentNo: "S2026002",
      currentGrade: "Year 11",
      currentClassName: "11B",
      email: "student2@xima.local",
      phone: "+8613800000003",
      status: "ACTIVE",
      entryYear: 2025,
    },
  });

  await prisma.teacherAssignment.upsert({
    where: {
      teacherId_subjectId: {
        teacherId: teacher.id,
        subjectId: physicsSubjectAqa.id,
      },
    },
    update: {},
    create: {
      teacherId: teacher.id,
      subjectId: physicsSubjectAqa.id,
    },
  });

  await prisma.registrationWindow.upsert({
    where: { id: "seed-window-aqa-summer" },
    update: {
      title: "AQA Summer 2026 Registration",
      startAt: new Date("2026-01-01"),
      endAt: new Date("2026-12-31"),
      status: "OPEN",
    },
    create: {
      id: "seed-window-aqa-summer",
      examBoardId: aqa.id,
      examSeriesId: aqaSummer2026.id,
      title: "AQA Summer 2026 Registration",
      startAt: new Date("2026-01-01"),
      endAt: new Date("2026-12-31"),
      status: "OPEN",
      createdById: adminUser.id,
    },
  });

  await prisma.registrationWindow.upsert({
    where: { id: "seed-window-cie-june" },
    update: {
      title: "Cambridge June 2026 Registration",
      startAt: new Date("2026-01-01"),
      endAt: new Date("2026-12-31"),
      status: "OPEN",
    },
    create: {
      id: "seed-window-cie-june",
      examBoardId: cie.id,
      examSeriesId: cieJune2026.id,
      title: "Cambridge June 2026 Registration",
      startAt: new Date("2026-01-01"),
      endAt: new Date("2026-12-31"),
      status: "OPEN",
      createdById: adminUser.id,
    },
  });

  await prisma.registrationWindow.upsert({
    where: { id: "seed-window-edexcel-summer" },
    update: {
      title: "Edexcel Summer 2026 Registration",
      startAt: new Date("2026-01-01"),
      endAt: new Date("2026-12-31"),
      status: "OPEN",
    },
    create: {
      id: "seed-window-edexcel-summer",
      examBoardId: edexcel.id,
      examSeriesId: edexcelSummer2026.id,
      title: "Edexcel Summer 2026 Registration",
      startAt: new Date("2026-01-01"),
      endAt: new Date("2026-12-31"),
      status: "OPEN",
      createdById: adminUser.id,
    },
  });

  console.log("Seed complete: exam boards, sample users, and registration windows.");
  console.log(`Admin: admin / ${adminEmail} — password from ADMIN_PASSWORD (default admin123)`);
  console.log(`Exam officer: examofficer — password123`);
  console.log(`Teacher: teacher@xima.local or +8613800000001 — password123 (assigned: Physics, all grades/boards)`);
  console.log(`Student 1: S2026001 or student@xima.local — password123 (Year 12 · 12A)`);
  console.log(`Student 2: S2026002 or student2@xima.local — password123 (Year 11 · 11B)`);

  const { backfillCandidatesFromStudents } = await import("../src/lib/candidates/service");
  const candidateBackfill = await backfillCandidatesFromStudents();
  console.log(`Candidates backfilled: ${candidateBackfill.created} created, ${candidateBackfill.processed} students processed.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
