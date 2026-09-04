import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canConfigureFeeRules } from "@/lib/auth/permissions";
import { syncSeriesSubjectFeeRules } from "@/lib/fees/fee-rules-series-sync";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: Promise<{ id: string }> };

/** Ensure fee rules exist for every subject that has sessions in this window's series. */
export async function POST(_request: Request, { params }: RouteParams) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;
  if (!canConfigureFeeRules(auth.user.role)) {
    return jsonError("Forbidden", 403);
  }

  const { id: registrationWindowId } = await params;

  try {
    const result = await syncSeriesSubjectFeeRules(registrationWindowId, auth.user.id);
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Sync failed", 500);
  }
}
