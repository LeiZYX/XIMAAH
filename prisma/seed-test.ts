import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { exitAfterPrismaScript, prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/lib/auth/password";
import { lockRegistrationsForWindow } from "../src/lib/registrations/lock";

const TEST_PASSWORD = "TestPass123!";

const IDS = {
  admin: "test-user-admin",
  examOfficer: "test-user-eo",
  teacher: "test-user-teacher",
  studentInternal: "test-user-student-internal",
  studentAssisted: "test-user-student-assisted",
  boardPearson: "test-board-pearson",
  boardCambridge: "test-board-cambridge",
  boardOxfordAqa: "test-board-oxfordaqa",
  qualPearson: "test-qual-pearson-maths",
  qualCambridge: "test-qual-cambridge-maths",
  qualOxford: "test-qual-oxford-maths",
  subjectPearson: "test-subject-pearson-maths",
  subjectCambridge: "test-subject-cambridge-maths",
  subjectOxford: "test-subject-oxford-maths",
  paperPearson: "test-paper-pearson-maths-1",
  paperPearson2: "test-paper-pearson-maths-2",
  paperCambridge: "test-paper-cambridge-maths-1",
  paperOxford: "test-paper-oxford-maths-1",
  seriesPearson: "test-series-pearson-2026",
  seriesCambridge: "test-series-cambridge-2026",
  seriesOxford: "test-series-oxford-2026",
  sessionOpen: "test-session-open-maths",
  sessionClosed1: "test-session-closed-maths-1",
  sessionClosed2: "test-session-closed-maths-2",
  sessionOfficeOnly: "test-session-office-only",
  windowOpen: "test-window-open",
  windowClosed: "test-window-closed",
  workspaceLocked: "test-workspace-locked",
  registrationLocked: "test-registration-locked",
  candidateExternal: "test-candidate-external",
  feeRuleClosed: "test-fee-rule-closed-maths",
  exchangeRateClosed: "test-exchange-rate-closed",
} as const;

async function createUser(params: {
  id: string;
  name: string;
  username: string;
  email: string;
  role: "ADMIN" | "EXAM_OFFICER" | "SUBJECT_TEACHER" | "STUDENT";
  studentNo?: string;
  grade?: string;
  className?: string;
}) {
  const passwordHash = await hashPassword(TEST_PASSWORD);
  return prisma.user.upsert({
    where: { id: params.id },
    update: {
      name: params.name,
      username: params.username,
      email: params.email,
      passwordHash,
      role: params.role,
      isActive: true,
      mustChangePassword: false,
      studentNo: params.studentNo ?? null,
    },
    create: {
      id: params.id,
      name: params.name,
      username: params.username,
      email: params.email,
      passwordHash,
      role: params.role,
      isActive: true,
      mustChangePassword: false,
      studentNo: params.studentNo ?? null,
      ...(params.role === "STUDENT" && params.studentNo
        ? {
            studentProfile: {
              create: {
                studentNo: params.studentNo,
                currentGrade: params.grade ?? "Year 12",
                currentClassName: params.className ?? "12A",
                email: params.email,
                status: "ACTIVE",
              },
            },
          }
        : {}),
    },
  });
}

async function main() {
  const admin = await createUser({
    id: IDS.admin,
    name: "Test Admin",
    username: "testadmin",
    email: "admin@xima.test",
    role: "ADMIN",
  });

  await createUser({
    id: IDS.examOfficer,
    name: "Test Exam Officer",
    username: "testeo",
    email: "examofficer@xima.test",
    role: "EXAM_OFFICER",
  });

  const teacher = await createUser({
    id: IDS.teacher,
    name: "Test Teacher",
    username: "testteacher",
    email: "teacher@xima.test",
    role: "SUBJECT_TEACHER",
  });

  const internalStudent = await createUser({
    id: IDS.studentInternal,
    name: "Test Internal Student",
    username: "teststudent",
    email: "student.internal@xima.test",
    role: "STUDENT",
    studentNo: "S2026888",
    grade: "Year 12",
    className: "12A",
  });

  const assistedStudent = await createUser({
    id: IDS.studentAssisted,
    name: "Test Assisted Student",
    username: "testassisted",
    email: "student.assisted@xima.test",
    role: "STUDENT",
    studentNo: "S2026889",
    grade: "Year 11",
    className: "11B",
  });

  const pearson = await prisma.examBoard.upsert({
    where: { id: IDS.boardPearson },
    update: { name: "Pearson Edexcel", code: "EDEXCEL" },
    create: {
      id: IDS.boardPearson,
      name: "Pearson Edexcel",
      code: "EDEXCEL",
      country: "GB",
      region: "United Kingdom",
      timezone: "Europe/London",
    },
  });

  const cambridge = await prisma.examBoard.upsert({
    where: { id: IDS.boardCambridge },
    update: { name: "Cambridge International", code: "CIE" },
    create: {
      id: IDS.boardCambridge,
      name: "Cambridge International",
      code: "CIE",
      country: "GB",
      region: "International",
      timezone: "Europe/London",
    },
  });

  await prisma.examBoard.upsert({
    where: { id: IDS.boardOxfordAqa },
    update: { name: "OxfordAQA", code: "OXFORDAQA" },
    create: {
      id: IDS.boardOxfordAqa,
      name: "OxfordAQA",
      code: "OXFORDAQA",
      country: "GB",
      region: "United Kingdom",
      timezone: "Europe/London",
    },
  });

  const qualPearson = await prisma.qualification.upsert({
    where: { id: IDS.qualPearson },
    update: {},
    create: {
      id: IDS.qualPearson,
      name: "GCSE Mathematics",
      level: "GCSE",
      code: "1MA1",
      examBoardId: pearson.id,
    },
  });

  const qualCambridge = await prisma.qualification.upsert({
    where: { id: IDS.qualCambridge },
    update: {},
    create: {
      id: IDS.qualCambridge,
      name: "IGCSE Mathematics",
      level: "IGCSE",
      code: "0580",
      examBoardId: cambridge.id,
    },
  });

  await prisma.qualification.upsert({
    where: { id: IDS.qualOxford },
    update: {},
    create: {
      id: IDS.qualOxford,
      name: "GCSE Mathematics",
      level: "GCSE",
      code: "8300",
      examBoardId: IDS.boardOxfordAqa,
    },
  });

  const subjectPearson = await prisma.subject.upsert({
    where: { id: IDS.subjectPearson },
    update: {},
    create: {
      id: IDS.subjectPearson,
      name: "Mathematics",
      code: "1MA1",
      qualificationId: qualPearson.id,
    },
  });

  await prisma.subject.upsert({
    where: { id: IDS.subjectCambridge },
    update: {},
    create: {
      id: IDS.subjectCambridge,
      name: "Mathematics",
      code: "0580",
      qualificationId: qualCambridge.id,
    },
  });

  await prisma.subject.upsert({
    where: { id: IDS.subjectOxford },
    update: {},
    create: {
      id: IDS.subjectOxford,
      name: "Mathematics",
      code: "8300",
      qualificationId: IDS.qualOxford,
    },
  });

  const paperPearson = await prisma.paper.upsert({
    where: { id: IDS.paperPearson },
    update: {},
    create: {
      id: IDS.paperPearson,
      code: "1MA1/1F",
      title: "Paper 1 Foundation",
      duration: 90,
      subjectId: subjectPearson.id,
    },
  });

  const paperPearson2 = await prisma.paper.upsert({
    where: { id: IDS.paperPearson2 },
    update: {},
    create: {
      id: IDS.paperPearson2,
      code: "1MA1/2F",
      title: "Paper 2 Foundation",
      duration: 90,
      subjectId: subjectPearson.id,
    },
  });

  await prisma.paper.upsert({
    where: { id: IDS.paperCambridge },
    update: {},
    create: {
      id: IDS.paperCambridge,
      code: "0580/21",
      title: "Paper 2 Extended",
      duration: 120,
      subjectId: IDS.subjectCambridge,
    },
  });

  await prisma.paper.upsert({
    where: { id: IDS.paperOxford },
    update: {},
    create: {
      id: IDS.paperOxford,
      code: "8300/1F",
      title: "Paper 1 Foundation",
      duration: 90,
      subjectId: IDS.subjectOxford,
    },
  });

  const seriesPearson = await prisma.examSeries.upsert({
    where: { id: IDS.seriesPearson },
    update: {},
    create: {
      id: IDS.seriesPearson,
      name: "Summer 2026",
      year: 2026,
      examBoardId: pearson.id,
      startDate: new Date("2026-05-01"),
      endDate: new Date("2026-06-30"),
    },
  });

  await prisma.examSeries.upsert({
    where: { id: IDS.seriesCambridge },
    update: {},
    create: {
      id: IDS.seriesCambridge,
      name: "June 2026",
      year: 2026,
      examBoardId: cambridge.id,
      startDate: new Date("2026-04-01"),
      endDate: new Date("2026-06-15"),
    },
  });

  await prisma.examSeries.upsert({
    where: { id: IDS.seriesOxford },
    update: {},
    create: {
      id: IDS.seriesOxford,
      name: "Summer 2026",
      year: 2026,
      examBoardId: IDS.boardOxfordAqa,
      startDate: new Date("2026-05-01"),
      endDate: new Date("2026-06-30"),
    },
  });

  await prisma.examSession.upsert({
    where: { id: IDS.sessionOpen },
    update: {},
    create: {
      id: IDS.sessionOpen,
      date: new Date("2026-05-20T09:00:00"),
      startTime: "09:00",
      endTime: "10:30",
      venue: "Hall A",
      paperId: paperPearson.id,
      examSeriesId: seriesPearson.id,
    },
  });

  await prisma.examSession.upsert({
    where: { id: IDS.sessionClosed1 },
    update: {},
    create: {
      id: IDS.sessionClosed1,
      date: new Date("2026-05-21T09:00:00"),
      startTime: "09:00",
      endTime: "10:30",
      venue: "Hall B",
      paperId: paperPearson.id,
      examSeriesId: seriesPearson.id,
    },
  });

  await prisma.examSession.upsert({
    where: { id: IDS.sessionClosed2 },
    update: {},
    create: {
      id: IDS.sessionClosed2,
      date: new Date("2026-06-05T13:00:00"),
      startTime: "13:00",
      endTime: "14:30",
      venue: "Hall C",
      paperId: paperPearson2.id,
      examSeriesId: seriesPearson.id,
    },
  });

  await prisma.examSession.upsert({
    where: { id: IDS.sessionOfficeOnly },
    update: {},
    create: {
      id: IDS.sessionOfficeOnly,
      date: new Date("2026-05-22T09:00:00"),
      startTime: "09:00",
      endTime: "10:30",
      venue: "Office",
      paperId: paperPearson.id,
      examSeriesId: seriesPearson.id,
    },
  });

  const now = new Date();
  const openStart = new Date(now);
  openStart.setDate(openStart.getDate() - 7);
  const openEnd = new Date(now);
  openEnd.setDate(openEnd.getDate() + 30);

  const closedStart = new Date(now);
  closedStart.setMonth(closedStart.getMonth() - 2);
  const closedEnd = new Date(now);
  closedEnd.setDate(closedEnd.getDate() - 14);

  const studentClose = new Date(now);
  studentClose.setDate(studentClose.getDate() + 14);

  await prisma.registrationWindow.upsert({
    where: { id: IDS.windowOpen },
    update: {
      status: "OPEN",
      studentRegistrationOpenAt: openStart,
      studentRegistrationCloseAt: studentClose,
      registrationCloseAt: openEnd,
    },
    create: {
      id: IDS.windowOpen,
      title: "Test Open Registration Window",
      examBoardId: pearson.id,
      examSeriesId: seriesPearson.id,
      studentRegistrationOpenAt: openStart,
      studentRegistrationCloseAt: studentClose,
      registrationCloseAt: openEnd,
      status: "OPEN",
      createdById: admin.id,
    },
  });

  await prisma.registrationWindow.upsert({
    where: { id: IDS.windowClosed },
    update: {
      status: "CLOSED",
      studentRegistrationOpenAt: closedStart,
      studentRegistrationCloseAt: closedEnd,
      registrationCloseAt: closedEnd,
    },
    create: {
      id: IDS.windowClosed,
      title: "Test Closed Registration Window",
      examBoardId: pearson.id,
      examSeriesId: seriesPearson.id,
      studentRegistrationOpenAt: closedStart,
      studentRegistrationCloseAt: closedEnd,
      registrationCloseAt: closedEnd,
      status: "CLOSED",
      createdById: admin.id,
    },
  });

  for (const [windowId, startAt, endAt, enableAll] of [
    [IDS.windowOpen, openStart, openEnd, true],
    [IDS.windowClosed, closedStart, closedEnd, false],
  ] as const) {
    const durationMs = endAt.getTime() - startAt.getTime();
    const third = Math.floor(durationMs / 3);
    const templates = [
      { stageCode: "NORMAL" as const, stageName: "Normal", sequence: 1 },
      { stageCode: "LATE" as const, stageName: "Late", sequence: 2 },
      { stageCode: "HIGH_LATE" as const, stageName: "High Late", sequence: 3 },
    ];

    for (const [index, template] of templates.entries()) {
      const stageStart =
        index === 0 ? startAt : new Date(startAt.getTime() + third * index);
      const stageEnd =
        index === templates.length - 1
          ? endAt
          : new Date(startAt.getTime() + third * (index + 1) - 1);

      await prisma.registrationFeeStage.upsert({
        where: {
          registrationWindowId_stageCode: {
            registrationWindowId: windowId,
            stageCode: template.stageCode,
          },
        },
        update: {
          stageName: template.stageName,
          sequence: template.sequence,
          startAt: stageStart,
          endAt: stageEnd,
          enabled: enableAll,
        },
        create: {
          registrationWindowId: windowId,
          stageCode: template.stageCode,
          stageName: template.stageName,
          sequence: template.sequence,
          startAt: stageStart,
          endAt: stageEnd,
          enabled: enableAll,
        },
      });
    }
  }

  await prisma.teacherAssignment.upsert({
    where: {
      teacherId_subjectId: {
        teacherId: teacher.id,
        subjectId: subjectPearson.id,
      },
    },
    update: {},
    create: {
      teacherId: teacher.id,
      subjectId: subjectPearson.id,
    },
  });

  const { syncCandidateFromStudentUser } = await import("../src/lib/candidates/service");
  const internalCandidate = await syncCandidateFromStudentUser(internalStudent.id);
  const assistedCandidate = await syncCandidateFromStudentUser(assistedStudent.id);
  if (!internalCandidate || !assistedCandidate) {
    throw new Error("Failed to sync internal candidates");
  }

  await prisma.candidate.upsert({
    where: { id: IDS.candidateExternal },
    update: {
      englishName: "Test External Candidate",
      candidateType: "EXTERNAL",
      loginEnabled: false,
    },
    create: {
      id: IDS.candidateExternal,
      candidateType: "EXTERNAL",
      assessmentHubCandidateNumber: "AH-TEST-EXT-001",
      englishName: "Test External Candidate",
      email: "external.candidate@xima.test",
      loginEnabled: false,
      status: "ACTIVE",
      sourceSystem: "MANUAL",
    },
  });

  await prisma.registrationWorkspace.upsert({
    where: { id: IDS.workspaceLocked },
    update: {
      lockedAt: closedEnd,
      candidateId: internalCandidate.id,
      studentId: internalStudent.id,
      registrationSource: "STUDENT_SUBMITTED",
      visibility: "STUDENT_AND_TEACHER",
      billingScope: "NORMAL_BILLING",
    },
    create: {
      id: IDS.workspaceLocked,
      candidateId: internalCandidate.id,
      studentId: internalStudent.id,
      registrationWindowId: IDS.windowClosed,
      lockedAt: closedEnd,
      registrationSource: "STUDENT_SUBMITTED",
      visibility: "STUDENT_AND_TEACHER",
      billingScope: "NORMAL_BILLING",
    },
  });

  await prisma.studentExamRegistration.upsert({
    where: { id: IDS.registrationLocked },
    update: {
      status: "LOCKED",
      lockedAt: closedEnd,
    },
    create: {
      id: IDS.registrationLocked,
      candidateId: internalCandidate.id,
      studentId: internalStudent.id,
      registrationWorkspaceId: IDS.workspaceLocked,
      examSessionId: IDS.sessionClosed1,
      registrationWindowId: IDS.windowClosed,
      examBoardId: pearson.id,
      examSeriesId: seriesPearson.id,
      subjectId: subjectPearson.id,
      paperId: paperPearson.id,
      studentNameSnapshot: internalStudent.name,
      studentNoSnapshot: "S2026888",
      gradeSnapshot: "Year 12",
      classNameSnapshot: "12A",
      emailSnapshot: internalStudent.email,
      assessmentHubCandidateNumberSnapshot: internalCandidate.assessmentHubCandidateNumber,
      candidateTypeSnapshot: "INTERNAL",
      status: "LOCKED",
      lockedAt: closedEnd,
      registrationSource: "STUDENT_SUBMITTED",
      visibility: "STUDENT_AND_TEACHER",
      billingScope: "NORMAL_BILLING",
    },
  });

  await lockRegistrationsForWindow(IDS.windowClosed, admin.id);

  await prisma.exchangeRate.upsert({
    where: { id: IDS.exchangeRateClosed },
    update: { rate: 9.25 },
    create: {
      id: IDS.exchangeRateClosed,
      registrationWindowId: IDS.windowClosed,
      baseCurrency: "GBP",
      targetCurrency: "CNY",
      rate: 9.25,
      effectiveDate: closedStart,
      createdByUserId: admin.id,
    },
  });

  await prisma.feeRule.upsert({
    where: { id: IDS.feeRuleClosed },
    update: { isActive: true },
    create: {
      id: IDS.feeRuleClosed,
      registrationWindowId: IDS.windowClosed,
      examBoardId: pearson.id,
      examSeriesId: seriesPearson.id,
      qualificationId: qualPearson.id,
      subjectId: subjectPearson.id,
      entryType: "NORMAL",
      costCurrency: "GBP",
      costAmount: 85,
      markupType: "PERCENTAGE",
      markupValue: 10,
      salesCurrency: "GBP",
      isActive: true,
      createdByUserId: admin.id,
    },
  });

  const manifest = {
    password: TEST_PASSWORD,
    accounts: {
      admin: { identifier: "admin@xima.test", homePath: "/admin", userId: IDS.admin },
      examOfficer: { identifier: "examofficer@xima.test", homePath: "/exam-office", userId: IDS.examOfficer },
      teacher: { identifier: "teacher@xima.test", homePath: "/teacher", userId: IDS.teacher },
      internalStudent: {
        identifier: "S2026888",
        homePath: "/student",
        userId: IDS.studentInternal,
        studentNo: "S2026888",
      },
      assistedStudent: {
        identifier: "S2026889",
        homePath: "/student",
        userId: IDS.studentAssisted,
        studentNo: "S2026889",
      },
      externalCandidate: {
        identifier: "external.candidate@xima.test",
        candidateId: IDS.candidateExternal,
        assessmentHubCandidateNumber: "AH-TEST-EXT-001",
      },
    },
    ids: {
      ...IDS,
      internalCandidateId: internalCandidate.id,
      assistedCandidateId: assistedCandidate.id,
    },
    examBoards: {
      pearson: { id: pearson.id, code: "EDEXCEL", name: "Pearson Edexcel" },
      cambridge: { id: cambridge.id, code: "CIE", name: "Cambridge International" },
      oxfordAqa: { id: IDS.boardOxfordAqa, code: "OXFORDAQA", name: "OxfordAQA" },
    },
  };

  const manifestPath = join(dirname(fileURLToPath(import.meta.url)), "../tests/fixtures/seed-manifest.json");
  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log("Test database seeded.");
  console.log(`Manifest written to ${manifestPath}`);
  console.log("Test accounts (password: TestPass123!):");
  console.log("  Admin:            admin@xima.test");
  console.log("  Exam Officer:     examofficer@xima.test");
  console.log("  Subject Teacher:  teacher@xima.test");
  console.log("  Internal Student: S2026888");
  console.log("  External Candidate: AH-TEST-EXT-001 (no login)");
}

main()
  .then(() => exitAfterPrismaScript(prisma, 0))
  .catch((error) => {
    console.error(error);
    void exitAfterPrismaScript(prisma, 1);
  });
