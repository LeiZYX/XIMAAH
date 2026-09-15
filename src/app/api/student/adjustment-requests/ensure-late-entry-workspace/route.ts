import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { RegistrationError } from "@/lib/registrations/errors";
import { ensureStudentLateEntryWorkspace } from "@/lib/registrations/student-adjustment-request";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  const auth = await requireAuth(["STUDENT"]);
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const data = parseJsonBody<{ registrationWindowId: string }>(body, ["registrationWindowId"]);
  if (!data) {
    return jsonError("registrationWindowId is required");
  }

  try {
    const workspace = await ensureStudentLateEntryWorkspace(
      auth.user.id,
      String(data.registrationWindowId),
    );
    return NextResponse.json({
      workspaceId: workspace.id,
      registrationNumber: workspace.registrationNumber,
      lockedAt: workspace.lockedAt,
      isLateRegistration: workspace.isLateRegistration,
    });
  } catch (error) {
    if (error instanceof RegistrationError) {
      return jsonError(error.message, error.status);
    }
    throw error;
  }
}
