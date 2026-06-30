import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { listChangeRequestsForReviewer } from "@/lib/registrations/change-request";
import { RegistrationChangeRequestStatus } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(["EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  const statusParam = request.nextUrl.searchParams.get("status");
  const registrationWindowId =
    request.nextUrl.searchParams.get("registrationWindowId") || undefined;
  const status =
    statusParam && Object.values(RegistrationChangeRequestStatus).includes(statusParam as never)
      ? (statusParam as RegistrationChangeRequestStatus)
      : undefined;

  const rows = await listChangeRequestsForReviewer({
    ...(status ? { status } : {}),
    ...(registrationWindowId ? { registrationWindowId } : {}),
  });
  return NextResponse.json(rows);
}
