import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { importInternalCandidates } from "@/lib/candidates/import";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  const data = parseJsonBody<{
    rows?: Array<Record<string, string | undefined>>;
    markMissingInactive?: boolean;
  }>(await request.json(), []);

  if (!Array.isArray(data?.rows) || data.rows.length === 0) {
    return jsonError("rows array is required", 400);
  }

  const result = await importInternalCandidates(data.rows, {
    markMissingInactive: Boolean(data.markMissingInactive),
  });
  return NextResponse.json(result);
}
