import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { buildBoardSubmissionWindowSummary } from "@/lib/board-submissions/summary";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  const registrationWindowId = request.nextUrl.searchParams.get("registrationWindowId");
  if (!registrationWindowId) {
    return jsonError("registrationWindowId is required", 400);
  }

  try {
    const summary = await buildBoardSubmissionWindowSummary(registrationWindowId);
    if (!summary) {
      return jsonError("Registration window not found", 404);
    }
    return NextResponse.json(summary);
  } catch (error) {
    console.error("Board submission summary error:", error);
    return jsonError(
      error instanceof Error ? error.message : "Failed to load board submission summary",
      500,
    );
  }
}
