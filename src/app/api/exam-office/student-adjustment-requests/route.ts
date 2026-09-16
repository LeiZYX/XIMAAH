import { NextRequest, NextResponse } from "next/server";
import { StudentAdjustmentRequestStatus } from "@/generated/prisma/enums";
import { requireAuth } from "@/lib/auth/require-auth";
import { listStudentAdjustmentRequestsForReview } from "@/lib/registrations/student-adjustment-request";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const VALID_STATUSES = new Set<string>(Object.values(StudentAdjustmentRequestStatus));

function parseStatuses(raw: string | null): StudentAdjustmentRequestStatus[] | undefined {
  if (!raw?.trim()) return undefined;
  const values = raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => VALID_STATUSES.has(part)) as StudentAdjustmentRequestStatus[];
  return values.length > 0 ? values : undefined;
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  const params = request.nextUrl.searchParams;
  const registrationWindowId = params.get("registrationWindowId") ?? undefined;
  const reviewedByTeacher = params.get("reviewedByTeacher") === "true";
  const statuses = parseStatuses(params.get("status"));
  const takeRaw = params.get("take");
  const take = takeRaw ? Number(takeRaw) : undefined;

  const rows = await listStudentAdjustmentRequestsForReview({
    status: statuses ?? StudentAdjustmentRequestStatus.PENDING_EO,
    registrationWindowId,
    reviewedByTeacher: reviewedByTeacher || undefined,
    take: Number.isFinite(take) ? take : undefined,
  });
  return NextResponse.json(rows);
}
