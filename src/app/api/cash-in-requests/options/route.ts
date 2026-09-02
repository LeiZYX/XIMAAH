import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { listCashInRequestFormOptions } from "@/lib/cash-in-requests/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  const examBoardId = request.nextUrl.searchParams.get("examBoardId");
  if (!examBoardId) return jsonError("examBoardId is required", 400);

  try {
    const options = await listCashInRequestFormOptions(examBoardId);
    return NextResponse.json(options);
  } catch (error) {
    console.error("GET /api/cash-in-requests/options failed:", error);
    return jsonError(
      error instanceof Error ? error.message : "Failed to load options",
      500,
    );
  }
}
