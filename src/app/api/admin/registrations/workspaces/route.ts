import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { containsFilter } from "@/lib/db/string-filters";
import { buildPaginationMeta, parseListPagination } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import {
  buildWorkspaceRegistrationTypeWhere,
  parseStaffRegistrationTypes,
} from "@/lib/registrations/workspace-type-filters";
import { parseGradeInput } from "@/lib/students/profile-enums";
import type { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PENDING_ADJUSTMENT_STATUSES = ["PENDING_TEACHER", "PENDING_EO"] as const;

const workspaceListInclude = {
  student: {
    select: {
      name: true,
      studentNo: true,
      email: true,
      studentProfile: { select: { currentGrade: true, currentClassName: true } },
    },
  },
  candidate: {
    select: {
      englishName: true,
      chineseName: true,
      surnamePinyin: true,
      givenNamePinyin: true,
      firstName: true,
      lastName: true,
      studentId: true,
      studentNumber: true,
      candidateType: true,
      email: true,
      phone: true,
      grade: true,
      className: true,
    },
  },
  registrationWindow: {
    include: { examBoard: true, examSeries: true },
  },
  registrations: {
    where: { status: { in: ["ACTIVE", "LOCKED"] as const } },
    select: {
      id: true,
      status: true,
      examSessionId: true,
      gradeSnapshot: true,
      classNameSnapshot: true,
      studentNameSnapshot: true,
      studentNoSnapshot: true,
    },
  },
  changeRequests: {
    select: { id: true, status: true },
  },
  studentAdjustmentRequests: {
    where: { status: { in: [...PENDING_ADJUSTMENT_STATUSES] } },
    select: { id: true, status: true },
  },
  lastAdjustedByUser: { select: { name: true } },
  restrictedCreatedBy: { select: { name: true } },
} satisfies Prisma.RegistrationWorkspaceInclude;

function buildStudentSearchOr(q: string): Prisma.RegistrationWorkspaceWhereInput[] {
  const term = containsFilter(q);
  return [
    { student: { is: { name: term } } },
    { student: { is: { email: term } } },
    { student: { is: { studentNo: term } } },
    { student: { is: { studentProfile: { is: { studentNo: term } } } } },
    { candidate: { is: { englishName: term } } },
    { candidate: { is: { chineseName: term } } },
    { candidate: { is: { surnamePinyin: term } } },
    { candidate: { is: { givenNamePinyin: term } } },
    { candidate: { is: { firstName: term } } },
    { candidate: { is: { lastName: term } } },
    { candidate: { is: { preferredEnglishName: term } } },
    { candidate: { is: { email: term } } },
    { candidate: { is: { studentNumber: term } } },
    { candidate: { is: { studentId: term } } },
    {
      registrations: {
        some: {
          status: { in: ["ACTIVE", "LOCKED"] },
          OR: [{ studentNameSnapshot: term }, { studentNoSnapshot: term }],
        },
      },
    },
  ];
}

function buildWorkspaceListWhere(input: {
  lockedOnly: boolean;
  registrationWindowId?: string;
  registrationTypes: ReturnType<typeof parseStaffRegistrationTypes>;
  q?: string;
  grade?: string;
  className?: string;
}): Prisma.RegistrationWorkspaceWhereInput {
  const and: Prisma.RegistrationWorkspaceWhereInput[] = [];

  if (input.registrationWindowId) {
    and.push({ registrationWindowId: input.registrationWindowId });
  }

  const typeWhere = buildWorkspaceRegistrationTypeWhere(input.registrationTypes);
  if (Object.keys(typeWhere).length > 0) {
    and.push(typeWhere);
  }

  if (input.lockedOnly) {
    and.push({
      OR: [
        { lockedAt: { not: null } },
        { registrations: { some: { status: "LOCKED" } } },
      ],
    });
  }

  if (input.q?.trim()) {
    and.push({ OR: buildStudentSearchOr(input.q.trim()) });
  }

  const grade = input.grade ? parseGradeInput(input.grade) : undefined;
  if (grade) {
    and.push({
      OR: [
        {
          registrations: {
            some: {
              status: { in: ["ACTIVE", "LOCKED"] },
              gradeSnapshot: grade,
            },
          },
        },
        { candidate: { is: { grade } } },
        { student: { is: { studentProfile: { is: { currentGrade: grade } } } } },
      ],
    });
  }

  if (input.className?.trim()) {
    const className = input.className.trim();
    and.push({
      OR: [
        {
          registrations: {
            some: {
              status: { in: ["ACTIVE", "LOCKED"] },
              classNameSnapshot: className,
            },
          },
        },
        { candidate: { is: { className } } },
        {
          student: {
            is: { studentProfile: { is: { currentClassName: className } } },
          },
        },
      ],
    });
  }

  if (and.length === 0) return {};
  if (and.length === 1) return and[0]!;
  return { AND: and };
}

async function loadFilterFacets(registrationWindowId: string | undefined) {
  if (!registrationWindowId) {
    return { grades: [] as string[], classes: [] as string[] };
  }

  const rows = await prisma.registrationWorkspace.findMany({
    where: {
      registrationWindowId,
      registrationType: "INTERNAL_NORMAL",
    },
    select: {
      candidate: { select: { grade: true, className: true } },
      student: {
        select: {
          studentProfile: { select: { currentGrade: true, currentClassName: true } },
        },
      },
      registrations: {
        where: { status: { in: ["ACTIVE", "LOCKED"] } },
        select: { gradeSnapshot: true, classNameSnapshot: true },
        take: 1,
      },
    },
    take: 2000,
  });

  const grades = new Set<string>();
  const classes = new Set<string>();
  for (const row of rows) {
    const grade =
      row.registrations[0]?.gradeSnapshot ||
      row.candidate?.grade ||
      row.student?.studentProfile?.currentGrade ||
      null;
    const className =
      row.registrations[0]?.classNameSnapshot ||
      row.candidate?.className ||
      row.student?.studentProfile?.currentClassName ||
      null;
    if (grade) grades.add(grade);
    if (className?.trim()) classes.add(className.trim());
  }

  return {
    grades: [...grades].sort(),
    classes: [...classes].sort((a, b) => a.localeCompare(b)),
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  // Skip backfillRegistrationWorkspaces() — it previously realigned every workspace on
  // each list load and made Internal/External registration pages very slow.

  const params = request.nextUrl.searchParams;
  const lockedOnly = params.get("lockedOnly") === "true";
  const registrationWindowId = params.get("registrationWindowId") || undefined;
  const registrationTypes = parseStaffRegistrationTypes(params);
  const all = params.get("all") === "true";
  const q = params.get("q")?.trim() || undefined;
  const grade = params.get("grade")?.trim() || undefined;
  const className = params.get("className")?.trim() || undefined;
  const where = buildWorkspaceListWhere({
    lockedOnly,
    registrationWindowId,
    registrationTypes,
    q,
    grade,
    className,
  });

  if (all) {
    const workspaces = await prisma.registrationWorkspace.findMany({
      where,
      include: workspaceListInclude,
      orderBy: { updatedAt: "desc" },
      take: 500,
    });
    return NextResponse.json(workspaces);
  }

  const { page, pageSize } = parseListPagination(params);
  const [total, facets] = await Promise.all([
    prisma.registrationWorkspace.count({ where }),
    loadFilterFacets(registrationWindowId),
  ]);
  const { skip, page: safePage, totalPages, pageSize: safePageSize } = buildPaginationMeta(
    total,
    page,
    pageSize,
  );

  const workspaces = await prisma.registrationWorkspace.findMany({
    where,
    include: workspaceListInclude,
    orderBy: { updatedAt: "desc" },
    skip,
    take: safePageSize,
  });

  return NextResponse.json({
    workspaces,
    total,
    page: safePage,
    totalPages,
    pageSize: safePageSize,
    registrationTypes,
    facets,
  });
}
