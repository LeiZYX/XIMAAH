import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { reviewChangeRequest } from "@/lib/registrations/change-request";
import { RegistrationError } from "@/lib/registrations/errors";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(["EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = await request.json();
  const data = parseJsonBody<{ reviewNote?: string }>(body, []);

  try {
    const workspace = await reviewChangeRequest(
      { id: auth.user.id, role: auth.user.role },
      id,
      "REJECTED",
      data?.reviewNote,
    );
    return NextResponse.json(workspace);
  } catch (error) {
    if (error instanceof RegistrationError) {
      return jsonError(error.message, error.status);
    }
    throw error;
  }
}
