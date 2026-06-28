import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canManageExamData, canViewAllRegistrations } from "@/lib/auth/permissions";
import { listCandidates, parseCandidateListFilters } from "@/lib/candidates/list";
import { createExternalCandidate } from "@/lib/candidates/service";
import { parseListPagination } from "@/lib/pagination";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;
  if (!canViewAllRegistrations(auth.user.role)) {
    return jsonError("Forbidden", 403);
  }

  try {
    const filters = parseCandidateListFilters(request.nextUrl.searchParams);
    const { page, pageSize } = parseListPagination(request.nextUrl.searchParams);
    const result = await listCandidates(filters, page, pageSize);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to list candidates:", error);
    const message = error instanceof Error ? error.message : "Failed to load candidates";
    if (message.includes("does not exist") || message.includes("P2021")) {
      return jsonError(
        "Candidate tables are not in the database yet. Run: npx prisma db push && npm run db:seed",
        503,
      );
    }
    if (message.includes("findMany")) {
      return jsonError(
        "Prisma client is out of date. Restart the dev server after running: npx prisma generate",
        503,
      );
    }
    return jsonError(message, 500);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;
  if (!canManageExamData(auth.user.role) && auth.user.role !== "EXAM_OFFICER") {
    return jsonError("Forbidden", 403);
  }

  const data = parseJsonBody<{
    candidateType?: string;
    englishName?: string;
    chineseName?: string;
    email?: string;
    phone?: string;
    studentNumber?: string;
    grade?: string;
    className?: string;
    assessmentHubCandidateNumber?: string;
    externalId?: string;
    schoolName?: string;
  }>(await request.json(), []);

  if (!data?.englishName?.trim()) {
    return jsonError("englishName is required", 400);
  }

  const candidateType = data.candidateType === "INTERNAL" ? "INTERNAL" : "EXTERNAL";

  try {
    if (candidateType === "EXTERNAL") {
      const candidate = await createExternalCandidate({
        englishName: data.englishName,
        chineseName: data.chineseName,
        email: data.email,
        phone: data.phone,
        schoolName: data.schoolName,
        assessmentHubCandidateNumber: data.assessmentHubCandidateNumber,
        externalId: data.externalId,
      });
      return NextResponse.json(candidate, { status: 201 });
    }

    return jsonError("Internal candidates should be synced from student profiles or imported", 400);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not create candidate", 500);
  }
}
