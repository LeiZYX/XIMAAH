import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canGenerateFeeStatements } from "@/lib/auth/permissions";
import { buildFeeDashboardMetrics } from "@/lib/fees/reporting";

export async function GET() {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;
  if (!canGenerateFeeStatements(auth.user.role)) {
    return jsonError("Forbidden", 403);
  }

  try {
    const metrics = await buildFeeDashboardMetrics();
    return NextResponse.json(metrics);
  } catch (error) {
    console.error("Fee dashboard error:", error);
    return jsonError(error instanceof Error ? error.message : "Failed to load fee metrics", 500);
  }
}
