import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { canViewAllRegistrations } from "@/lib/auth/permissions";
import { candidatesToCsv } from "@/lib/candidates/export";
import { buildCandidateWhere, parseCandidateListFilters } from "@/lib/candidates/list";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;
  if (!canViewAllRegistrations(auth.user.role)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const filters = parseCandidateListFilters(request.nextUrl.searchParams);
  const candidates = await prisma.candidate.findMany({
    where: buildCandidateWhere(filters),
    orderBy: [{ englishName: "asc" }],
    include: {
      examIdentities: {
        include: { examBoard: { select: { code: true } } },
        orderBy: { examBoard: { name: "asc" } },
        take: 1,
      },
    },
  });

  const csv = candidatesToCsv(candidates);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="candidates-export.csv"',
    },
  });
}
