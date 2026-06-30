import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  const { searchParams } = request.nextUrl;
  const candidateId = searchParams.get("candidateId");
  const examBoardId = searchParams.get("examBoardId");

  const where: Record<string, unknown> = {};
  if (candidateId) where.candidateId = candidateId;
  if (examBoardId) where.examBoardId = examBoardId;

  const rows = await prisma.candidateBoardRegistration.findMany({
    where,
    include: {
      candidate: {
        select: {
          id: true,
          englishName: true,
          assessmentHubCandidateNumber: true,
          studentNumber: true,
        },
      },
      examBoard: { select: { id: true, name: true, code: true } },
      feeStatement: { select: { id: true, statementNo: true, status: true } },
    },
    orderBy: [{ updatedAt: "desc" }],
  });

  return NextResponse.json(rows);
}
