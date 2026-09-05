import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { RegistrationError } from "@/lib/registrations/errors";
import {
  listStudentAdjustmentRequestsForStudent,
  submitStudentAdjustmentRequest,
  type StudentAdjustmentSubmitItem,
} from "@/lib/registrations/student-adjustment-request";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const auth = await requireAuth(["STUDENT"]);
  if (auth.error) return auth.error;

  const rows = await listStudentAdjustmentRequestsForStudent(auth.user.id);
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(["STUDENT"]);
  if (auth.error) return auth.error;

  const body = await request.json();
  const data = parseJsonBody<{
    registrationWorkspaceId: string;
    items: StudentAdjustmentSubmitItem[];
  }>(body, ["registrationWorkspaceId", "items"]);

  if (!data || !Array.isArray(data.items)) {
    return jsonError("registrationWorkspaceId and items are required");
  }

  try {
    const created = await submitStudentAdjustmentRequest(
      { id: auth.user.id },
      {
        registrationWorkspaceId: String(data.registrationWorkspaceId),
        items: data.items,
      },
    );
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof RegistrationError) {
      return jsonError(error.message, error.status);
    }
    throw error;
  }
}
