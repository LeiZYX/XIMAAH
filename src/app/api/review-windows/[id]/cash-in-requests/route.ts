import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: Promise<{ id: string }> };

const requestInclude = {
  candidate: {
    select: {
      id: true,
      englishName: true,
      assessmentHubCandidateNumber: true,
    },
  },
  qualification: { select: { id: true, name: true, level: true } },
  subject: { select: { id: true, name: true, code: true } },
  requestedBy: { select: { id: true, name: true } },
};

export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  const { id: reviewWindowId } = await params;
  const status = request.nextUrl.searchParams.get("status");
  const candidateId = request.nextUrl.searchParams.get("candidateId");

  const where: Record<string, unknown> = { reviewWindowId };
  if (status) where.status = status;
  if (candidateId) where.candidateId = candidateId;

  const requests = await prisma.cashInRequest.findMany({
    where,
    include: requestInclude,
    orderBy: [{ createdAt: "desc" }],
  });

  return NextResponse.json(requests);
}
