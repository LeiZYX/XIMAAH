import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { RegistrationError } from "@/lib/registrations/errors";
import { reviewStudentAdjustmentAsTeacher } from "@/lib/registrations/student-adjustment-request";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(["SUBJECT_TEACHER"]);
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const data = parseJsonBody<{ reviewReason?: string }>(body, []);
  const reviewReason = data?.reviewReason?.trim() ?? "";

  try {
    const updated = await reviewStudentAdjustmentAsTeacher(
      { id: auth.user.id, role: auth.user.role },
      id,
      "APPROVED",
      reviewReason,
    );
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof RegistrationError) {
      return jsonError(error.message, error.status);
    }
    throw error;
  }
}
