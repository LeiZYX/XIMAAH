import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { listQualificationsForBoard, listSubjectsForBoard } from "@/lib/cash-in-codes/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  const examBoardId = request.nextUrl.searchParams.get("examBoardId");
  if (!examBoardId) return jsonError("examBoardId is required", 400);

  try {
    const [subjects, qualifications] = await Promise.all([
      listSubjectsForBoard(examBoardId),
      listQualificationsForBoard(examBoardId),
    ]);
    return NextResponse.json({ subjects, qualifications });
  } catch (error) {
    console.error("GET /api/cash-in-codes/options failed:", error);
    return jsonError(
      error instanceof Error ? error.message : "Failed to load options",
      500,
    );
  }
}
