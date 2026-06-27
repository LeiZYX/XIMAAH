import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { reviewChangeRequest } from "@/lib/registrations/change-request";
import { RegistrationError } from "@/lib/registrations/errors";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(["EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  const { id } = await params;

  try {
    const workspace = await reviewChangeRequest(
      { id: auth.user.id, role: auth.user.role },
      id,
      "APPROVED",
    );
    return NextResponse.json(workspace);
  } catch (error) {
    if (error instanceof RegistrationError) {
      return jsonError(error.message, error.status);
    }
    throw error;
  }
}
