import * as XLSX from "xlsx";
import type { Prisma } from "@/generated/prisma/client";
import type { CandidateType, Gender, StudentProfileStatus } from "@/generated/prisma/enums";
import { hashPassword } from "@/lib/auth/password";
import { syncCandidateFromStudentUser } from "@/lib/candidates/service";
import {
  buildStudentProfileWhere,
  parseStudentStatusFilter,
  type StudentStatusFilter,
} from "@/lib/students/archive";
import { buildPaginationMeta } from "@/lib/pagination";
import { containsFilter, equalsFilter } from "@/lib/db/string-filters";
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
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "MALE" || normalized === "FEMALE" || normalized === "OTHER") {
    return normalized;
  }
  if (normalized === "男" || normalized === "M") return "MALE";
  if (normalized === "女" || normalized === "F") return "FEMALE";
  return undefined;
}

function mapStudentRow(
  student: Prisma.UserGetPayload<{
    include: { studentProfile: true; candidate: true };
  }>,
) {
  return {
    id: student.id,
    name: student.name,
    email: student.email ?? student.studentProfile?.email ?? null,
    phone: student.phone ?? student.studentProfile?.phone ?? null,
    isActive: student.isActive,
    studentNo: student.studentProfile?.studentNo ?? student.studentNo ?? null,
    candidateNumber: student.candidate?.assessmentHubCandidateNumber ?? null,
    chineseName: student.candidate?.chineseName ?? null,
    grade: student.studentProfile?.currentGrade ?? null,
    className: student.studentProfile?.currentClassName ?? null,
    idCardNumber: student.studentProfile?.idCardNumber ?? null,
    gender: student.studentProfile?.gender ?? null,
    status: student.studentProfile?.status ?? "ACTIVE",
    studentType: student.candidate?.candidateType ?? "INTERNAL",
    entryYear: student.studentProfile?.entryYear ?? null,
    graduationYear: student.studentProfile?.graduationYear ?? null,
  };
}

export async function listStudentIdentities(
  filters: StudentIdentityFilters,
  page = 1,
  pageSize = 50,
) {
  const status = filters.status ?? "ACTIVE";
  const profileWhere = buildStudentProfileWhere(status);

  const where: Prisma.UserWhereInput = {
    role: "STUDENT",
    studentProfile: {
      is: {
        ...profileWhere,
        ...(filters.grade ? { currentGrade: filters.grade } : {}),
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
      { candidate: { is: { chineseName: containsFilter(filters.q) } } },
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

export async function exportStudentIdentities(filters: StudentIdentityFilters) {
  const result = await listStudentIdentities(filters, 1, 10_000);
  return result.students.map((row) => ({
    studentNumber: row.studentNo ?? "",
    candidateNumber: row.candidateNumber ?? "",
    chineseName: row.chineseName ?? "",
    englishName: row.name,
    idCardNumber: row.idCardNumber ?? "",
    gender: row.gender ?? "",
    email: row.email ?? "",
    phone: row.phone ?? "",
    grade: row.grade ?? "",
    className: row.className ?? "",
    status: row.status,
    studentType: row.studentType,
    accountActive: row.isActive ? "YES" : "NO",
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
          currentGrade: row.grade,
          currentClassName: row.className,
          idCardNumber: row.idCardNumber ?? null,
          gender: row.gender ?? null,
          email: row.email ?? null,
          phone: row.phone ?? null,
          status,
        },
      });
      if (row.candidateNumber || row.chineseName) {
        await prisma.candidate.updateMany({
          where: { userId: existingProfile.userId },
          data: {
            ...(row.candidateNumber
              ? { assessmentHubCandidateNumber: row.candidateNumber }
              : {}),
            ...(row.chineseName ? { chineseName: row.chineseName } : {}),
            englishName: row.englishName,
            grade: row.grade,
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
            currentGrade: row.grade,
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
    if (row.candidateNumber || row.chineseName || row.studentType === "EXTERNAL") {
      await prisma.candidate.update({
        where: { userId: user.id },
        data: {
          ...(row.candidateNumber
            ? { assessmentHubCandidateNumber: row.candidateNumber }
            : {}),
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

export async function upsertStudentIdentity(
  performedById: string,
  input: {
    id?: string;
    englishName: string;
    chineseName?: string;
    studentNumber: string;
    candidateNumber?: string;
    email?: string;
    phone?: string;
    grade: string;
    className: string;
    idCardNumber?: string;
    gender?: Gender;
    status?: StudentProfileStatus;
    isActive?: boolean;
    studentType?: CandidateType;
    password?: string;
  },
) {
  const passwordHash = input.password
    ? await hashPassword(input.password)
    : await hashPassword(input.studentNumber);

  if (input.id) {
    const user = await prisma.user.update({
      where: { id: input.id },
      data: {
        name: input.englishName,
        email: input.email ?? null,
        phone: input.phone ?? null,
        isActive: input.isActive ?? true,
        ...(input.password ? { passwordHash, mustChangePassword: false } : {}),
        studentProfile: {
          update: {
            studentNo: input.studentNumber,
            currentGrade: input.grade,
            currentClassName: input.className,
            idCardNumber: input.idCardNumber ?? null,
            gender: input.gender ?? null,
            email: input.email ?? null,
            phone: input.phone ?? null,
            status: input.status ?? "ACTIVE",
          },
        },
      },
      include: { studentProfile: true, candidate: true },
    });
    await syncCandidateFromStudentUser(user.id);
    if (input.candidateNumber || input.chineseName) {
      await prisma.candidate.updateMany({
        where: { userId: user.id },
        data: {
          ...(input.candidateNumber
            ? { assessmentHubCandidateNumber: input.candidateNumber }
            : {}),
          ...(input.chineseName ? { chineseName: input.chineseName } : {}),
          candidateType: input.studentType ?? "INTERNAL",
        },
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
      name: input.englishName,
      email: input.email ?? null,
      phone: input.phone ?? null,
      studentNo: input.studentNumber,
      role: "STUDENT",
      isActive: input.isActive ?? true,
      passwordHash,
      mustChangePassword: true,
      studentProfile: {
        create: {
          studentNo: input.studentNumber,
          currentGrade: input.grade,
          currentClassName: input.className,
          idCardNumber: input.idCardNumber ?? null,
          gender: input.gender ?? null,
          email: input.email ?? null,
          phone: input.phone ?? null,
          status: input.status ?? "ACTIVE",
        },
      },
    },
    include: { studentProfile: true, candidate: true },
  });
  await syncCandidateFromStudentUser(user.id);
  if (input.candidateNumber || input.chineseName) {
    await prisma.candidate.update({
      where: { userId: user.id },
      data: {
        ...(input.candidateNumber
          ? { assessmentHubCandidateNumber: input.candidateNumber }
          : {}),
        ...(input.chineseName ? { chineseName: input.chineseName } : {}),
        candidateType: input.studentType ?? "INTERNAL",
      },
    });
  }
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
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Students");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
