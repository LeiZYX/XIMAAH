import * as XLSX from "xlsx";
import type { Prisma } from "@/generated/prisma/client";
import type { TeacherProfileStatus } from "@/generated/prisma/enums";
import { hashPassword } from "@/lib/auth/password";
import { buildPaginationMeta } from "@/lib/pagination";
import { containsFilter } from "@/lib/db/string-filters";
import { logUserAudit } from "@/lib/users/audit";
import { prisma } from "@/lib/prisma";

export interface TeacherIdentityFilters {
  q?: string;
  status?: TeacherProfileStatus | "ALL";
  subjectId?: string;
  grade?: string;
  className?: string;
}

export function parseTeacherIdentityFilters(searchParams: URLSearchParams): TeacherIdentityFilters {
  const status = searchParams.get("status");
  return {
    q: searchParams.get("q")?.trim() || undefined,
    status:
      status === "ACTIVE" || status === "INACTIVE" || status === "ALL" ? status : "ACTIVE",
    subjectId: searchParams.get("subjectId")?.trim() || undefined,
    grade: searchParams.get("grade")?.trim() || undefined,
    className: searchParams.get("className")?.trim() || undefined,
  };
}

function parseJsonStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function mapTeacherRow(
  teacher: Prisma.UserGetPayload<{
    include: { teacherProfile: true; teacherAssignments: { include: { subject: true } } };
  }>,
) {
  return {
    id: teacher.id,
    name: teacher.name,
    email: teacher.email ?? teacher.teacherProfile?.email ?? null,
    phone: teacher.phone ?? teacher.teacherProfile?.phone ?? null,
    isActive: teacher.isActive,
    status: teacher.teacherProfile?.status ?? "ACTIVE",
    subjects: teacher.teacherAssignments.map((row) => ({
      id: row.subject.id,
      name: row.subject.name,
      code: row.subject.code,
    })),
    grades: parseJsonStringArray(teacher.teacherProfile?.visibleGrades),
    classes: parseJsonStringArray(teacher.teacherProfile?.visibleClasses),
  };
}

export async function listTeacherIdentities(
  filters: TeacherIdentityFilters,
  page = 1,
  pageSize = 50,
) {
  const and: Prisma.UserWhereInput[] = [{ role: "SUBJECT_TEACHER" }];

  if (filters.status && filters.status !== "ALL") {
    if (filters.status === "ACTIVE") {
      and.push({
        OR: [
          { teacherProfile: { is: { status: "ACTIVE" } } },
          { teacherProfile: { is: null } },
        ],
      });
    } else {
      and.push({ teacherProfile: { is: { status: filters.status } } });
    }
  }

  if (filters.subjectId) {
    and.push({ teacherAssignments: { some: { subjectId: filters.subjectId } } });
  }

  if (filters.q) {
    and.push({
      OR: [
        { name: containsFilter(filters.q) },
        { email: containsFilter(filters.q) },
        { phone: containsFilter(filters.q) },
      ],
    });
  }

  const where: Prisma.UserWhereInput = { AND: and };

  const total = await prisma.user.count({ where });
  const { skip, page: safePage, totalPages } = buildPaginationMeta(total, page, pageSize);

  let rows = await prisma.user.findMany({
    where,
    include: {
      teacherProfile: true,
      teacherAssignments: { include: { subject: true } },
    },
    orderBy: [{ name: "asc" }],
    skip,
    take: pageSize,
  });

  if (filters.grade || filters.className) {
    rows = rows.filter((teacher) => {
      const grades = parseJsonStringArray(teacher.teacherProfile?.visibleGrades);
      const classes = parseJsonStringArray(teacher.teacherProfile?.visibleClasses);
      if (filters.grade && grades.length > 0 && !grades.includes(filters.grade)) {
        return false;
      }
      if (filters.className && classes.length > 0 && !classes.includes(filters.className)) {
        return false;
      }
      return true;
    });
  }

  return {
    teachers: rows.map(mapTeacherRow),
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}

export async function exportTeacherIdentities(filters: TeacherIdentityFilters) {
  const result = await listTeacherIdentities(filters, 1, 10_000);
  return result.teachers.map((row) => ({
    name: row.name,
    email: row.email ?? "",
    phone: row.phone ?? "",
    subjects: row.subjects.map((s) => s.code).join(", "),
    grades: row.grades.join(", "),
    classes: row.classes.join(", "),
    role: "SUBJECT_TEACHER",
    status: row.status,
    accountActive: row.isActive ? "YES" : "NO",
  }));
}

export interface TeacherImportRow {
  name: string;
  email?: string;
  phone?: string;
  subjects?: string;
  grades?: string;
  classes?: string;
  role?: string;
  status?: TeacherProfileStatus;
}

export function parseTeacherImportWorkbook(buffer: ArrayBuffer): TeacherImportRow[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  return raw.map((row) => ({
    name: String(row.name ?? "").trim(),
    email: String(row.email ?? "").trim() || undefined,
    phone: String(row.phone ?? "").trim() || undefined,
    subjects: String(row.subjects ?? "").trim() || undefined,
    grades: String(row.grades ?? "").trim() || undefined,
    classes: String(row.classes ?? "").trim() || undefined,
    role: String(row.role ?? "SUBJECT_TEACHER").trim(),
    status: (String(row.status ?? "ACTIVE").trim().toUpperCase() ||
      "ACTIVE") as TeacherProfileStatus,
  }));
}

export function validateTeacherImportRows(rows: TeacherImportRow[]) {
  const errors: Array<{ row: number; message: string }> = [];
  rows.forEach((row, index) => {
    const rowNum = index + 2;
    if (!row.name) errors.push({ row: rowNum, message: "name is required" });
    if (!row.email && !row.phone) {
      errors.push({ row: rowNum, message: "email or phone is required" });
    }
  });
  return errors;
}

async function resolveSubjectIds(subjectCodes: string) {
  const codes = subjectCodes
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (codes.length === 0) return [];

  const subjects = await prisma.subject.findMany({
    where: { OR: codes.map((code) => ({ code })) },
    select: { id: true, code: true },
  });
  return subjects.map((subject) => subject.id);
}

export async function commitTeacherImportRows(
  rows: TeacherImportRow[],
  performedById: string,
) {
  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const existing = await prisma.user.findFirst({
      where: {
        role: "SUBJECT_TEACHER",
        OR: [
          ...(row.email ? [{ email: row.email }] : []),
          ...(row.phone ? [{ phone: row.phone }] : []),
        ],
      },
      include: { teacherProfile: true },
    });

    const grades = row.grades
      ?.split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    const classes = row.classes
      ?.split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    const subjectIds = row.subjects ? await resolveSubjectIds(row.subjects) : [];
    const passwordHash = await hashPassword("changeme123");

    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          name: row.name,
          email: row.email ?? existing.email,
          phone: row.phone ?? existing.phone,
          teacherProfile: {
            upsert: {
              create: {
                email: row.email ?? null,
                phone: row.phone ?? null,
                status: row.status ?? "ACTIVE",
                visibleGrades: grades ?? [],
                visibleClasses: classes ?? [],
              },
              update: {
                email: row.email ?? null,
                phone: row.phone ?? null,
                status: row.status ?? "ACTIVE",
                visibleGrades: grades ?? [],
                visibleClasses: classes ?? [],
              },
            },
          },
        },
      });
      if (subjectIds.length > 0) {
        await prisma.teacherAssignment.deleteMany({ where: { teacherId: existing.id } });
        await prisma.teacherAssignment.createMany({
          data: subjectIds.map((subjectId) => ({
            teacherId: existing.id,
            subjectId,
          })),
          skipDuplicates: true,
        });
      }
      updated += 1;
      continue;
    }

    const user = await prisma.user.create({
      data: {
        name: row.name,
        email: row.email ?? null,
        phone: row.phone ?? null,
        role: "SUBJECT_TEACHER",
        passwordHash,
        mustChangePassword: true,
        teacherProfile: {
          create: {
            email: row.email ?? null,
            phone: row.phone ?? null,
            status: row.status ?? "ACTIVE",
            visibleGrades: grades ?? [],
            visibleClasses: classes ?? [],
          },
        },
        ...(subjectIds.length > 0
          ? {
              teacherAssignments: {
                create: subjectIds.map((subjectId) => ({ subjectId })),
              },
            }
          : {}),
      },
    });

    await logUserAudit({
      action: "USER_CREATED",
      performedById,
      targetUserId: user.id,
      metadata: { source: "teacher_import" },
    });
    created += 1;
  }

  await logUserAudit({
    action: "TEACHER_IMPORTED",
    performedById,
    metadata: { created, updated, total: rows.length },
  });

  return { created, updated };
}

export async function upsertTeacherIdentity(
  performedById: string,
  input: {
    id?: string;
    name: string;
    email?: string;
    phone?: string;
    status?: TeacherProfileStatus;
    isActive?: boolean;
    subjectIds?: string[];
    grades?: string[];
    classes?: string[];
    password?: string;
  },
) {
  const passwordHash = input.password
    ? await hashPassword(input.password)
    : await hashPassword("changeme123");

  if (input.id) {
    const user = await prisma.user.update({
      where: { id: input.id },
      data: {
        name: input.name,
        email: input.email ?? null,
        phone: input.phone ?? null,
        isActive: input.isActive ?? true,
        ...(input.password ? { passwordHash, mustChangePassword: false } : {}),
        teacherProfile: {
          upsert: {
            create: {
              email: input.email ?? null,
              phone: input.phone ?? null,
              status: input.status ?? "ACTIVE",
              visibleGrades: input.grades ?? [],
              visibleClasses: input.classes ?? [],
            },
            update: {
              email: input.email ?? null,
              phone: input.phone ?? null,
              status: input.status ?? "ACTIVE",
              visibleGrades: input.grades ?? [],
              visibleClasses: input.classes ?? [],
            },
          },
        },
      },
    });

    if (input.subjectIds) {
      await prisma.teacherAssignment.deleteMany({ where: { teacherId: user.id } });
      if (input.subjectIds.length > 0) {
        await prisma.teacherAssignment.createMany({
          data: input.subjectIds.map((subjectId) => ({ teacherId: user.id, subjectId })),
          skipDuplicates: true,
        });
      }
    }

    await logUserAudit({
      action: "USER_UPDATED",
      performedById,
      targetUserId: user.id,
    });

    return mapTeacherRow(
      await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
        include: {
          teacherProfile: true,
          teacherAssignments: { include: { subject: true } },
        },
      }),
    );
  }

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email ?? null,
      phone: input.phone ?? null,
      role: "SUBJECT_TEACHER",
      isActive: input.isActive ?? true,
      passwordHash,
      mustChangePassword: true,
      teacherProfile: {
        create: {
          email: input.email ?? null,
          phone: input.phone ?? null,
          status: input.status ?? "ACTIVE",
          visibleGrades: input.grades ?? [],
          visibleClasses: input.classes ?? [],
        },
      },
      ...(input.subjectIds && input.subjectIds.length > 0
        ? {
            teacherAssignments: {
              create: input.subjectIds.map((subjectId) => ({ subjectId })),
            },
          }
        : {}),
    },
  });

  await logUserAudit({
    action: "USER_CREATED",
    performedById,
    targetUserId: user.id,
  });

  return mapTeacherRow(
    await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: {
        teacherProfile: true,
        teacherAssignments: { include: { subject: true } },
      },
    }),
  );
}

export function teacherRowsToWorkbook(rows: Record<string, string>[]) {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Teachers");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
