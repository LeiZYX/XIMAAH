import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canManageRegistrationWindows } from "@/lib/auth/permissions";
import {
  createCashInRequest,
  listCashInRequests,
} from "@/lib/cash-in-requests/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  const { searchParams } = request.nextUrl;
  try {
    const rows = await listCashInRequests({
      examBoardId: searchParams.get("examBoardId") ?? undefined,
      examSeriesId: searchParams.get("examSeriesId") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      candidateId: searchParams.get("candidateId") ?? undefined,
      q: searchParams.get("q") ?? undefined,
    });
    return NextResponse.json(rows);
  } catch (error) {
    console.error("GET /api/cash-in-requests failed:", error);
    return jsonError(
      error instanceof Error ? error.message : "Failed to list cash-in requests",
      500,
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;
  if (!canManageRegistrationWindows(auth.user.role)) {
    return jsonError("Forbidden", 403);
  }

  const body = await request.json().catch(() => null);
  const data = parseJsonBody<{
    candidateId?: string;
    examBoardId?: string;
    examSeriesId?: string;
    subjectId?: string;
    reason?: string | null;
    notes?: string | null;
    status?: "DRAFT" | "SUBMITTED";
  }>(body, ["candidateId", "examBoardId", "examSeriesId", "subjectId"]);

  if (!data?.candidateId || !data.examBoardId || !data.examSeriesId || !data.subjectId) {
    return jsonError(
      "candidateId, examBoardId, examSeriesId, and subjectId are required",
      400,
    );
  }

  try {
    const created = await createCashInRequest({
      candidateId: data.candidateId,
      examBoardId: data.examBoardId,
      examSeriesId: data.examSeriesId,
      subjectId: data.subjectId,
      requestedByUserId: auth.user.id,
      reason: data.reason,
      notes: data.notes,
      status: data.status,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("POST /api/cash-in-requests failed:", error);
    return jsonError(
      error instanceof Error ? error.message : "Failed to create cash-in request",
      400,
    );
  }
}
