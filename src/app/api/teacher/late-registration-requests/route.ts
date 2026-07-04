import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { submitTeacherLateRegistrationAdjustment } from "@/lib/registrations/change-request";
import { RegistrationError } from "@/lib/registrations/errors";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  const auth = await requireAuth(["SUBJECT_TEACHER"]);
  if (auth.error) return auth.error;

  const body = await request.json();
  const data = parseJsonBody<{
    studentId?: string;
    registrationWindowId?: string;
    examSessionIds?: string[];
    removeRegistrationIds?: string[];
    reason?: string;
  }>(body, []);

  if (!data?.studentId || !data.registrationWindowId || !data.reason?.trim()) {
    return jsonError("studentId, registrationWindowId, and reason are required", 400);
  }

  const examSessionIds = Array.isArray(data.examSessionIds) ? data.examSessionIds : [];
  const removeRegistrationIds = Array.isArray(data.removeRegistrationIds)
    ? data.removeRegistrationIds
    : [];

  if (examSessionIds.length === 0 && removeRegistrationIds.length === 0) {
    return jsonError("Select at least one exam session to add or remove", 400);
  }

  try {
    const requests = await submitTeacherLateRegistrationAdjustment(
      { id: auth.user.id, role: auth.user.role },
      {
        studentId: data.studentId,
        registrationWindowId: data.registrationWindowId,
        examSessionIds,
        removeRegistrationIds,
        reason: data.reason.trim(),
      },
    );
    return NextResponse.json(
      {
        requests,
        count: requests.length,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof RegistrationError) {
      return jsonError(error.message, error.status);
    }
    throw error;
  }
}
