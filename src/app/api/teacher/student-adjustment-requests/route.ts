import { NextRequest, NextResponse } from "next/server";
import { StudentAdjustmentRequestStatus } from "@/generated/prisma/enums";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { listStudentAdjustmentRequestsForReview } from "@/lib/registrations/student-adjustment-request";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(["SUBJECT_TEACHER"]);
  if (auth.error) return auth.error;

  const statusParam = request.nextUrl.searchParams.get("status");
  const registrationWindowId =
    request.nextUrl.searchParams.get("registrationWindowId") ?? undefined;

  const status =
    statusParam === "PENDING_TEACHER" ||
    statusParam === "PENDING_EO" ||
    statusParam === "APPROVED" ||
    statusParam === "REJECTED"
      ? (statusParam as StudentAdjustmentRequestStatus)
      : StudentAdjustmentRequestStatus.PENDING_TEACHER;

  const rows = await listStudentAdjustmentRequestsForReview({
    status,
    registrationWindowId,
    reviewerTeacherId: auth.user.id,
  });
  return NextResponse.json(rows);
}
