import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { previewCandidateRegistrationFee } from "@/lib/fees/candidate-registration-fee";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  const examBoardId = request.nextUrl.searchParams.get("examBoardId");
  const registrationWindowId = request.nextUrl.searchParams.get("registrationWindowId");

  if (!examBoardId || !registrationWindowId) {
    return jsonError("examBoardId and registrationWindowId are required", 400);
  }

  const preview = await previewCandidateRegistrationFee(examBoardId, registrationWindowId);
  return NextResponse.json({ preview });
}
