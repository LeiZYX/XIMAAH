import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { applyStaffStudentRegistrationAfterStudentClose } from "@/lib/registrations/late-registration";
import { RegistrationError } from "@/lib/registrations/errors";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  const auth = await requireAuth(["ADMIN"]);
  if (auth.error) return auth.error;

  const body = await request.json();
  const data = parseJsonBody<{
    studentId?: string;
    registrationWindowId?: string;
    examSessionIds?: string[];
    reason?: string;
  }>(body, []);

  if (!data?.studentId || !data.registrationWindowId || !data.reason?.trim()) {
    return jsonError("studentId, registrationWindowId, and reason are required", 400);
  }

  const examSessionIds = Array.isArray(data.examSessionIds) ? data.examSessionIds : [];
  if (examSessionIds.length === 0) {
    return jsonError("At least one exam session must be selected", 400);
  }

  try {
    const workspace = await applyStaffStudentRegistrationAfterStudentClose(
      { id: auth.user.id, role: auth.user.role },
      {
        studentId: data.studentId,
        registrationWindowId: data.registrationWindowId,
        examSessionIds,
        reason: data.reason.trim(),
      },
    );
    return NextResponse.json(workspace, { status: 201 });
  } catch (error) {
    if (error instanceof RegistrationError) {
      return jsonError(error.message, error.status);
    }
    throw error;
  }
}
