import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { buildPaginationMeta, parseListPagination } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { backfillRegistrationWorkspaces } from "@/lib/registrations/workspace";
import {
  buildWorkspaceRegistrationTypeWhere,
  parseStaffRegistrationTypes,
} from "@/lib/registrations/workspace-type-filters";
import type { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
      studentNumber: true,
      candidateType: true,
      email: true,
      phone: true,
      grade: true,
      className: true,
      assessmentHubCandidateNumber: true,
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
  lastAdjustedByUser: { select: { name: true } },
  restrictedCreatedBy: { select: { name: true } },
} satisfies Prisma.RegistrationWorkspaceInclude;

function buildWorkspaceListWhere(
  lockedOnly: boolean,
  registrationWindowId?: string,
  registrationTypes = parseStaffRegistrationTypes(new URLSearchParams()),
): Prisma.RegistrationWorkspaceWhereInput {
  return {
    ...(registrationWindowId ? { registrationWindowId } : {}),
    ...buildWorkspaceRegistrationTypeWhere(registrationTypes),
    ...(lockedOnly
      ? {
          OR: [
            { lockedAt: { not: null } },
            { registrations: { some: { status: "LOCKED" } } },
          ],
        }
      : {}),
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  await backfillRegistrationWorkspaces();

  const params = request.nextUrl.searchParams;
  const lockedOnly = params.get("lockedOnly") === "true";
  const registrationWindowId = params.get("registrationWindowId") || undefined;
  const registrationTypes = parseStaffRegistrationTypes(params);
  const all = params.get("all") === "true";
  const where = buildWorkspaceListWhere(lockedOnly, registrationWindowId, registrationTypes);

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
  const total = await prisma.registrationWorkspace.count({ where });
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
  });
}
