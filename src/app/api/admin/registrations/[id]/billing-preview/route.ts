import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { buildWorkspaceBillingPreview } from "@/lib/fees/billing-preview";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  const { id } = await params;
  const includeCandidateRegistrationFee =
    request.nextUrl.searchParams.get("includeCandidateRegistrationFee") === "true";

  const lines = await buildWorkspaceBillingPreview({
    workspaceId: id,
    includeCandidateRegistrationFee,
  });

  return NextResponse.json({ lines });
}
