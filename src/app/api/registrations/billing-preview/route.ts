import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { buildModalBillingPreview } from "@/lib/fees/billing-preview";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  const data = parseJsonBody<{
    registrationWindowId?: string;
    examSessionIds?: string[];
    includeCandidateRegistrationFee?: boolean;
  }>(await request.json(), []);

  if (!data?.registrationWindowId) {
    return jsonError("registrationWindowId is required", 400);
  }

  const lines = await buildModalBillingPreview({
    registrationWindowId: data.registrationWindowId,
    examSessionIds: Array.isArray(data.examSessionIds) ? data.examSessionIds : [],
    includeCandidateRegistrationFee: Boolean(data.includeCandidateRegistrationFee),
  });

  return NextResponse.json({ lines });
}
