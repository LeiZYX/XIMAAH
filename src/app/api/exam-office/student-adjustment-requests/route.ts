import { NextRequest, NextResponse } from "next/server";
import { StudentAdjustmentRequestStatus } from "@/generated/prisma/enums";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { listStudentAdjustmentRequestsForReview } from "@/lib/registrations/student-adjustment-request";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
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
      : StudentAdjustmentRequestStatus.PENDING_EO;

  const rows = await listStudentAdjustmentRequestsForReview({
    status,
    registrationWindowId,
  });
  return NextResponse.json(rows);
}
