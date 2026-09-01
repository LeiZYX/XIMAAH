import * as XLSX from "xlsx";
import type { Prisma } from "@/generated/prisma/client";
import type { CandidateType, Gender, Grade, StudentProfileStatus } from "@/generated/prisma/enums";
import { hashPassword } from "@/lib/auth/password";
import {
  ensureInternalCandidatesSynced,
  generateAssessmentHubCandidateNumber,
  syncCandidateFromStudentUser,
} from "@/lib/candidates/service";
import { backfillMissingStudentIds, generateStudentId } from "@/lib/candidates/student-id";
import {
  buildStudentProfileWhere,
  parseStudentStatusFilter,
  type StudentStatusFilter,
} from "@/lib/students/archive";
import {
  formatDateOfBirth,
  parseDateOfBirthInput,
  parseGenderInput,
  parseGradeInput,
} from "@/lib/students/profile-enums";
import { resolveSchoolStudentNumber } from "@/lib/students/identifiers";
import { buildPaginationMeta } from "@/lib/pagination";
import { containsFilter } from "@/lib/db/string-filters";
import { composeLegalEnglishName, computeDisplayName } from "@/lib/candidates/identity";
import { logUserAudit } from "@/lib/users/audit";
import { prisma } from "@/lib/prisma";

export interface StudentIdentityFilters {
  status?: StudentStatusFilter;
  q?: string;
  grade?: string;
  className?: string;
  studentType?: CandidateType;
}

export function parseStudentIdentityFilters(searchParams: URLSearchParams): StudentIdentityFilters {
  const studentType = searchParams.get("studentType");
  return {
    status: parseStudentStatusFilter(searchParams.get("status")),
    q: searchParams.get("q")?.trim() || undefined,
    grade: searchParams.get("grade")?.trim() || undefined,
    className: searchParams.get("className")?.trim() || undefined,
    studentType:
      studentType === "INTERNAL" || studentType === "EXTERNAL" ? studentType : undefined,
  };
}

function parseGender(value: unknown): Gender | undefined {
  return parseGenderInput(value);
}

function mapStudentRow(
  student: Prisma.UserGetPayload<{
    include: { studentProfile: true; candidate: true };
  }>,
) {
  const candidate = student.candidate;
  const profile = student.studentProfile;
  const displayName = computeDisplayName({
    preferredEnglishName: candidate?.preferredEnglishName,
    firstName: candidate?.firstName,
    lastName: candidate?.lastName,
    legalEnglishName: candidate?.legalEnglishName,
    englishName: candidate?.englishName ?? student.name,
  });
  return {
    id: student.id,
    name: displayName || student.name,
    email: candidate?.email ?? student.email ?? profile?.email ?? null,
    phone: candidate?.phone ?? student.phone ?? profile?.phone ?? null,
    isActive: student.isActive,
    studentNo: candidate?.studentNumber ?? null,
    candidateId: candidate?.id ?? null,
    candidateNumber: candidate?.assessmentHubCandidateNumber ?? null,
    studentId: candidate?.studentId ?? null,
    chineseName: candidate?.chineseName ?? null,
    pinyinLastName: candidate?.surnamePinyin ?? null,
    pinyinFirstName: candidate?.givenNamePinyin ?? null,
    preferredEnglishName: candidate?.preferredEnglishName ?? null,
    firstName: candidate?.firstName ?? null,
    lastName: candidate?.lastName ?? null,
    idNumber: candidate?.idNumber ?? profile?.idCardNumber ?? null,
    passportNumber: candidate?.passportNumber ?? null,
    dateOfBirth: candidate?.dateOfBirth ? formatDateOfBirth(candidate.dateOfBirth) : null,
    grade: candidate?.grade ?? profile?.currentGrade ?? null,
    className: candidate?.className ?? profile?.currentClassName ?? null,
    idCardNumber: candidate?.idNumber ?? profile?.idCardNumber ?? null,
    gender: candidate?.gender ?? profile?.gender ?? null,
    status: candidate?.status ?? profile?.status ?? "ACTIVE",
    studentType: candidate?.candidateType ?? "INTERNAL",
    entryYear: profile?.entryYear ?? null,
    graduationYear: profile?.graduationYear ?? null,
  };
}

export async function listStudentIdentities(
  filters: StudentIdentityFilters,
  page = 1,
  pageSize = 50,
) {
  await ensureInternalCandidatesSynced();
  await backfillMissingStudentIds().catch(() => undefined);
  const status = filters.status ?? "ACTIVE";
  const profileWhere = buildStudentProfileWhere(status);

  const where: Prisma.UserWhereInput = {
    role: "STUDENT",
    studentProfile: {
      is: {
        ...profileWhere,
        ...(filters.grade ? { currentGrade: filters.grade as Grade } : {}),
        ...(filters.className ? { currentClassName: filters.className } : {}),
      },
    },
    ...(filters.studentType
      ? { candidate: { is: { candidateType: filters.studentType } } }
      : {}),
  };

  if (filters.q) {
    where.OR = [
      { name: containsFilter(filters.q) },
      { email: containsFilter(filters.q) },
      { phone: containsFilter(filters.q) },
      { studentNo: containsFilter(filters.q) },
      { studentProfile: { is: { studentNo: containsFilter(filters.q) } } },
      { studentProfile: { is: { idCardNumber: containsFilter(filters.q) } } },
      { candidate: { is: { assessmentHubCandidateNumber: containsFilter(filters.q) } } },
      { candidate: { is: { studentId: containsFilter(filters.q) } } },
      { candidate: { is: { chineseName: containsFilter(filters.q) } } },
      { candidate: { is: { firstName: containsFilter(filters.q) } } },
      { candidate: { is: { lastName: containsFilter(filters.q) } } },
      { candidate: { is: { preferredEnglishName: containsFilter(filters.q) } } },
      { candidate: { is: { legalEnglishName: containsFilter(filters.q) } } },
      { candidate: { is: { englishName: containsFilter(filters.q) } } },
    ];
  }

  const total = await prisma.user.count({ where });
  const { skip, page: safePage, totalPages } = buildPaginationMeta(total, page, pageSize);

  const rows = await prisma.user.findMany({
    where,
    include: { studentProfile: true, candidate: true },
    orderBy: [{ name: "asc" }],
    skip,
    take: pageSize,
  });

  return {
    students: rows.map(mapStudentRow),
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}

const INTERNAL_STUDENT_EXPORT_COLUMNS = [
  "Student ID",
  "School Student Number",
  "Chinese Name",
  "Preferred English Name",
  "Firstname",
  "Lastname",
  "English Name",
  "Pinyin Last Name",
  "Pinyin First Name",
  "ID Number",
  "Passport Number",
  "Gender",
  "Date of Birth",
  "Grade",
  "Class",
  "Phone",
  "Email",
  "Status",
] as const;

export async function exportStudentIdentities(filters: StudentIdentityFilters) {
  const result = await listStudentIdentities(filters, 1, 10_000);
  return result.students.map((row) => ({
    "Student ID": row.studentId ?? "",
    "School Student Number": row.studentNo ?? "",
    "Chinese Name": row.chineseName ?? "",
    "Preferred English Name": row.preferredEnglishName ?? "",
    Firstname: row.firstName ?? "",
    Lastname: row.lastName ?? "",
    "English Name": row.name,
    "Pinyin Last Name": row.pinyinLastName ?? "",
    "Pinyin First Name": row.pinyinFirstName ?? "",
    "ID Number": row.idNumber ?? row.idCardNumber ?? "",
    "Passport Number": row.passportNumber ?? "",
    Gender: row.gender ?? "",
    "Date of Birth": row.dateOfBirth ?? "",
    Grade: row.grade ?? "",
    Class: row.className ?? "",
    Phone: row.phone ?? "",
    Email: row.email ?? "",
    Status: row.status,
  }));
}

export interface StudentImportRow {
  studentNumber: string;
  candidateNumber?: string;
  chineseName?: string;
  englishName: string;
  idCardNumber?: string;
  gender?: Gender;
  email?: string;
  phone?: string;
  grade: string;
  className: string;
  status?: StudentProfileStatus;
  studentType?: CandidateType;
}

export function parseStudentImportWorkbook(buffer: ArrayBuffer): StudentImportRow[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  return raw.map((row) => ({
    studentNumber: String(row.studentNumber ?? row.studentNo ?? "").trim(),
    candidateNumber: String(row.candidateNumber ?? "").trim() || undefined,
    chineseName: String(row.chineseName ?? "").trim() || undefined,
    englishName: String(row.englishName ?? row.name ?? "").trim(),
    idCardNumber: String(row.idCardNumber ?? row.idCard ?? "").trim() || undefined,
    gender: parseGender(row.gender),
    email: String(row.email ?? "").trim() || undefined,
    phone: String(row.phone ?? "").trim() || undefined,
    grade: String(row.grade ?? "").trim(),
    className: String(row.className ?? row.class ?? "").trim(),
    status: (String(row.status ?? "ACTIVE").trim().toUpperCase() ||
      "ACTIVE") as StudentProfileStatus,
    studentType: (String(row.studentType ?? "INTERNAL").trim().toUpperCase() ||
      "INTERNAL") as CandidateType,
  }));
}

export function validateStudentImportRows(rows: StudentImportRow[]) {
  const errors: Array<{ row: number; message: string }> = [];
  const seenStudentNumbers = new Set<string>();

  rows.forEach((row, index) => {
    const rowNum = index + 2;
    if (!row.studentNumber) errors.push({ row: rowNum, message: "studentNumber is required" });
    if (!row.englishName) errors.push({ row: rowNum, message: "englishName is required" });
    if (!row.grade) errors.push({ row: rowNum, message: "grade is required" });
    const parsedGrade = parseGradeInput(row.grade);
    if (row.grade && !parsedGrade) {
      errors.push({ row: rowNum, message: "grade must be one of G9, G10, G11, G12" });
    }
    if (!row.className) errors.push({ row: rowNum, message: "className is required" });
    if (row.studentNumber) {
      if (seenStudentNumbers.has(row.studentNumber)) {
        errors.push({ row: rowNum, message: `Duplicate studentNumber ${row.studentNumber}` });
      }
      seenStudentNumbers.add(row.studentNumber);
    }
  });

  return errors;
}

export async function commitStudentImportRows(
  rows: StudentImportRow[],
  performedById: string,
) {
  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const existingProfile = await prisma.studentProfile.findUnique({
      where: { studentNo: row.studentNumber },
      include: { user: true },
    });

    const passwordHash = await hashPassword(row.studentNumber);
    const status = row.status ?? "ACTIVE";
    const grade = parseGradeInput(row.grade);
    if (!grade) continue;

    if (existingProfile) {
      await prisma.user.update({
        where: { id: existingProfile.userId },
        data: {
          name: row.englishName,
          email: row.email ?? undefined,
          phone: row.phone ?? undefined,
        },
      });
      await prisma.studentProfile.update({
        where: { id: existingProfile.id },
        data: {
          currentGrade: grade,
          currentClassName: row.className,
          idCardNumber: row.idCardNumber ?? null,
          gender: row.gender ?? null,
          email: row.email ?? null,
          phone: row.phone ?? null,
          status,
        },
      });
      if (row.chineseName) {
        await prisma.candidate.updateMany({
          where: { userId: existingProfile.userId },
          data: {
            ...(row.chineseName ? { chineseName: row.chineseName } : {}),
            englishName: row.englishName,
            grade,
            className: row.className,
          },
        });
      }
      await syncCandidateFromStudentUser(existingProfile.userId);
      updated += 1;
      continue;
    }

    const user = await prisma.user.create({
      data: {
        name: row.englishName,
        email: row.email ?? null,
        phone: row.phone ?? null,
        studentNo: row.studentNumber,
        role: "STUDENT",
        passwordHash,
        mustChangePassword: true,
        studentProfile: {
          create: {
            studentNo: row.studentNumber,
            currentGrade: grade,
            currentClassName: row.className,
            idCardNumber: row.idCardNumber ?? null,
            gender: row.gender ?? null,
            email: row.email ?? null,
            phone: row.phone ?? null,
            status,
          },
        },
      },
    });

    await syncCandidateFromStudentUser(user.id);
    if (row.chineseName || row.studentType === "EXTERNAL") {
      await prisma.candidate.update({
        where: { userId: user.id },
        data: {
          ...(row.chineseName ? { chineseName: row.chineseName } : {}),
          candidateType: row.studentType ?? "INTERNAL",
        },
      });
    }

    await logUserAudit({
      action: "USER_CREATED",
      performedById,
      targetUserId: user.id,
      metadata: { source: "student_import" },
    });
    created += 1;
  }

  await logUserAudit({
    action: "STUDENT_IMPORTED",
    performedById,
    metadata: { created, updated, total: rows.length },
  });

  return { created, updated };
}

function profileLoginStudentNo(input: {
  schoolStudentNumber?: string;
  permanentStudentId: string;
}): string {
  return input.schoolStudentNumber?.trim() || input.permanentStudentId;
}

export async function upsertStudentIdentity(
  performedById: string,
  input: {
    id?: string;
    firstName?: string;
    lastName?: string;
    preferredEnglishName?: string;
    englishName?: string;
    chineseName?: string;
    pinyinLastName?: string;
    pinyinFirstName?: string;
    studentNumber?: string;
    email?: string;
    phone?: string;
    grade: Grade | string;
    className: string;
    idCardNumber?: string;
    idNumber?: string;
    passportNumber?: string;
    dateOfBirth?: string;
    gender?: Gender;
    status?: StudentProfileStatus;
    isActive?: boolean;
    studentType?: CandidateType;
    password?: string;
  },
) {
  const grade = parseGradeInput(input.grade);
  if (!grade) {
    throw new Error("Grade must be one of G9, G10, G11, G12");
  }

  const firstName = input.firstName?.trim() || null;
  const lastName = input.lastName?.trim() || null;
  const preferredEnglishName = input.preferredEnglishName?.trim() || null;
  const legalEnglishName =
    composeLegalEnglishName({
      firstName,
      lastName,
      legalEnglishName: input.englishName,
    }) || null;
  if (!firstName || !lastName) {
    throw new Error("Firstname and Lastname are required");
  }
  const displayName = computeDisplayName({
    preferredEnglishName,
    firstName,
    lastName,
    legalEnglishName,
    englishName: input.englishName,
  });

  const idNumber = input.idNumber ?? input.idCardNumber;
  const dateOfBirth = input.dateOfBirth ? parseDateOfBirthInput(input.dateOfBirth) : undefined;

  const schoolStudentNumber = resolveSchoolStudentNumber(input);
  let permanentStudentId: string | undefined;
  let existingSchoolStudentNumber: string | undefined;

  if (input.id) {
    const existingUser = await prisma.user.findUnique({
      where: { id: input.id },
      include: { studentProfile: true, candidate: true },
    });
    if (!existingUser) throw new Error("Student not found");
    permanentStudentId = existingUser.candidate?.studentId ?? undefined;
    existingSchoolStudentNumber = existingUser.candidate?.studentNumber?.trim() || undefined;
  } else {
    permanentStudentId = await generateStudentId();
  }

  const resolvedSchoolStudentNumber = schoolStudentNumber ?? existingSchoolStudentNumber;
  const profileStudentNo = profileLoginStudentNo({
    schoolStudentNumber: resolvedSchoolStudentNumber,
    permanentStudentId: permanentStudentId!,
  });

  const passwordSeed =
    input.password ??
    input.email?.trim() ??
    resolvedSchoolStudentNumber ??
    permanentStudentId!;
  const passwordHash = input.password
    ? await hashPassword(input.password)
    : await hashPassword(passwordSeed);

  const assessmentHubCandidateNumber =
    (input.id
      ? (
          await prisma.candidate.findFirst({
            where: { userId: input.id },
            select: { assessmentHubCandidateNumber: true },
          })
        )?.assessmentHubCandidateNumber
      : undefined) || generateAssessmentHubCandidateNumber();

  const candidateData = {
    chineseName: input.chineseName ?? null,
    preferredEnglishName,
    firstName,
    lastName,
    englishName: displayName,
    legalEnglishName,
    surnamePinyin: input.pinyinLastName ?? null,
    givenNamePinyin: input.pinyinFirstName ?? null,
    assessmentHubCandidateNumber,
    idNumber: idNumber ?? null,
    passportNumber: input.passportNumber ?? null,
    idDocumentNumber: idNumber ?? null,
    idDocumentType: idNumber ? ("CHINESE_ID_CARD" as const) : input.passportNumber ? ("PASSPORT" as const) : null,
    gender: input.gender ?? null,
    dateOfBirth: dateOfBirth ?? null,
    grade,
    className: input.className,
    email: input.email ?? null,
    phone: input.phone ?? null,
    studentNumber: resolvedSchoolStudentNumber ?? null,
    candidateType: input.studentType ?? ("INTERNAL" as const),
    status: (input.status ?? "ACTIVE") as StudentProfileStatus,
  };

  if (input.id) {
    const user = await prisma.user.update({
      where: { id: input.id },
      data: {
        name: displayName,
        email: input.email ?? null,
        phone: input.phone ?? null,
        studentNo: profileStudentNo,
        isActive: input.isActive ?? true,
        ...(input.password ? { passwordHash, mustChangePassword: false } : {}),
        studentProfile: {
          update: {
            studentNo: profileStudentNo,
            currentGrade: grade,
            currentClassName: input.className,
            idCardNumber: idNumber ?? null,
            gender: input.gender ?? null,
            email: input.email ?? null,
            phone: input.phone ?? null,
            status: input.status ?? "ACTIVE",
          },
        },
      },
      include: { studentProfile: true, candidate: true },
    });

    if (user.candidate) {
      await prisma.candidate.update({
        where: { id: user.candidate.id },
        data: candidateData,
      });
    } else {
      await syncCandidateFromStudentUser(user.id);
      await prisma.candidate.updateMany({
        where: { userId: user.id },
        data: candidateData,
      });
    }

    await logUserAudit({
      action: "USER_UPDATED",
      performedById,
      targetUserId: user.id,
    });
    return mapStudentRow(
      await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
        include: { studentProfile: true, candidate: true },
      }),
    );
  }

  const user = await prisma.user.create({
    data: {
      name: displayName,
      email: input.email ?? null,
      phone: input.phone ?? null,
      studentNo: profileStudentNo,
      role: "STUDENT",
      isActive: input.isActive ?? true,
      passwordHash,
      mustChangePassword: true,
      studentProfile: {
        create: {
          studentNo: profileStudentNo,
          currentGrade: grade,
          currentClassName: input.className,
          idCardNumber: idNumber ?? null,
          gender: input.gender ?? null,
          email: input.email ?? null,
          phone: input.phone ?? null,
          status: input.status ?? "ACTIVE",
        },
      },
      candidate: {
        create: {
          studentId: permanentStudentId!,
          candidateType: input.studentType ?? "INTERNAL",
          assessmentHubCandidateNumber,
          preferredEnglishName,
          firstName,
          lastName,
          englishName: displayName,
          legalEnglishName,
          chineseName: input.chineseName ?? null,
          surnamePinyin: input.pinyinLastName ?? null,
          givenNamePinyin: input.pinyinFirstName ?? null,
          idNumber: idNumber ?? null,
          passportNumber: input.passportNumber ?? null,
          idDocumentNumber: idNumber ?? null,
          idDocumentType: candidateData.idDocumentType,
          gender: input.gender ?? null,
          dateOfBirth: dateOfBirth ?? null,
          grade,
          className: input.className,
          email: input.email ?? null,
          phone: input.phone ?? null,
          studentNumber: resolvedSchoolStudentNumber ?? null,
          status: (input.status ?? "ACTIVE") as StudentProfileStatus,
          loginEnabled: input.isActive ?? true,
          sourceSystem: "STUDENT_PROFILE",
        },
      },
    },
    include: { studentProfile: true, candidate: true },
  });

  await logUserAudit({
    action: "USER_CREATED",
    performedById,
    targetUserId: user.id,
  });
  return mapStudentRow(
    await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { studentProfile: true, candidate: true },
    }),
  );
}

export function studentRowsToWorkbook(rows: Record<string, string>[]) {
  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: [...INTERNAL_STUDENT_EXPORT_COLUMNS],
  });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Students");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
