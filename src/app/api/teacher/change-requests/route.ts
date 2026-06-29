import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import {
  listTeacherChangeRequests,
  submitTeacherChangeRequest,
} from "@/lib/registrations/change-request";
import { RegistrationError } from "@/lib/registrations/errors";
import { RegistrationChangeRequestType } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const auth = await requireAuth(["SUBJECT_TEACHER"]);
  if (auth.error) return auth.error;

  const rows = await listTeacherChangeRequests(auth.user.id);
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(["SUBJECT_TEACHER"]);
  if (auth.error) return auth.error;

  const body = await request.json();
  const data = parseJsonBody<{
    registrationWorkspaceId?: string;
    requestType?: string;
    targetExamSessionId?: string;
    targetRegistrationId?: string;
    replacementExamSessionId?: string;
    reason?: string;
  }>(body, []);

  if (!data?.registrationWorkspaceId || !data.requestType || !data.reason?.trim()) {
    return jsonError("registrationWorkspaceId, requestType, and reason are required", 400);
  }

  if (!Object.values(RegistrationChangeRequestType).includes(data.requestType as RegistrationChangeRequestType)) {
    return jsonError("Invalid requestType", 400);
  }

  if (data.requestType === RegistrationChangeRequestType.LATE_REGISTRATION) {
    return jsonError("Use /api/teacher/late-registration-requests for late registration", 400);
  }

  try {
    const requestRow = await submitTeacherChangeRequest(
      { id: auth.user.id, role: auth.user.role },
      {
        registrationWorkspaceId: data.registrationWorkspaceId,
        requestType: data.requestType as RegistrationChangeRequestType,
        targetExamSessionId: data.targetExamSessionId,
        targetRegistrationId: data.targetRegistrationId,
        replacementExamSessionId: data.replacementExamSessionId,
        reason: data.reason.trim(),
      },
    );
    return NextResponse.json(requestRow, { status: 201 });
  } catch (error) {
    if (error instanceof RegistrationError) {
      return jsonError(error.message, error.status);
    }
    throw error;
  }
}
