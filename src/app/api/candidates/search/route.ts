import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { buildCandidateWhere, parseCandidateListFilters } from "@/lib/candidates/list";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER", "SUBJECT_TEACHER"]);
  if (auth.error) return auth.error;

  const filters = parseCandidateListFilters(request.nextUrl.searchParams);
  if (auth.user.role === "SUBJECT_TEACHER") {
    filters.candidateType = "INTERNAL";
  }

  const candidates = await prisma.candidate.findMany({
    where: buildCandidateWhere(filters),
    select: {
      id: true,
      englishName: true,
      chineseName: true,
      assessmentHubCandidateNumber: true,
      studentNumber: true,
      candidateType: true,
      grade: true,
      className: true,
      email: true,
    },
    orderBy: { englishName: "asc" },
    take: 30,
  });

  return NextResponse.json(candidates);
}
