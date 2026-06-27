import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { reviewChangeRequest } from "@/lib/registrations/change-request";
import { RegistrationError } from "@/lib/registrations/errors";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; requestId: string }> },
) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  const { requestId } = await params;
  const body = await request.json();
  const data = parseJsonBody<{ decision?: string; reviewNote?: string }>(body, []);

  if (data?.decision !== "APPROVED" && data?.decision !== "REJECTED") {
    return jsonError("decision must be APPROVED or REJECTED", 400);
  }

  try {
    const workspace = await reviewChangeRequest(
      { id: auth.user.id, role: auth.user.role },
      requestId,
      data.decision,
      data.reviewNote,
    );
    return NextResponse.json(workspace);
  } catch (error) {
    if (error instanceof RegistrationError) {
      return jsonError(error.message, error.status);
    }
    throw error;
  }
}
