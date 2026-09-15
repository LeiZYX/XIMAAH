import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { listStudentLateEntryAdjustmentWindows } from "@/lib/registrations/student-adjustment-request";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const auth = await requireAuth(["STUDENT"]);
  if (auth.error) return auth.error;

  const windows = await listStudentLateEntryAdjustmentWindows(auth.user.id);
  return NextResponse.json(
    windows.map((window) => ({
      ...window,
      studentRegistrationOpenAt: window.studentRegistrationOpenAt.toISOString(),
      studentRegistrationCloseAt: window.studentRegistrationCloseAt.toISOString(),
      registrationCloseAt: window.registrationCloseAt.toISOString(),
      studentAdjustmentRequestCloseAt: window.studentAdjustmentRequestCloseAt
        ? window.studentAdjustmentRequestCloseAt.toISOString()
        : null,
      existingWorkspaceId: window.existingWorkspaceId,
    })),
  );
}
