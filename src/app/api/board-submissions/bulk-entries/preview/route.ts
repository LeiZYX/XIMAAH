import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { buildBulkEntriesPreview } from "@/lib/board-submissions/bulk-entries/build";

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
    const preview = await buildBulkEntriesPreview(registrationWindowId);
    if (!preview) {
      return jsonError("Registration window not found", 404);
    }
    return NextResponse.json(preview);
  } catch (error) {
    console.error("Bulk entries preview error:", error);
    return jsonError(
      error instanceof Error ? error.message : "Failed to load bulk entries preview",
      500,
    );
  }
}
