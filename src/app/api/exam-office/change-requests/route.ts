import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { listChangeRequestsForReviewer } from "@/lib/registrations/change-request";
import { RegistrationChangeRequestStatus } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const VALID_STATUSES = new Set<string>(Object.values(RegistrationChangeRequestStatus));

function parseStatuses(
  raw: string | null,
): RegistrationChangeRequestStatus | RegistrationChangeRequestStatus[] | undefined {
  if (!raw?.trim()) return undefined;
  const values = raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => VALID_STATUSES.has(part)) as RegistrationChangeRequestStatus[];
  if (values.length === 0) return undefined;
  if (values.length === 1) return values[0];
  return values;
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(["EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  const params = request.nextUrl.searchParams;
  const registrationWindowId = params.get("registrationWindowId") || undefined;
  const status = parseStatuses(params.get("status"));
  const takeRaw = params.get("take");
  const take = takeRaw ? Number(takeRaw) : undefined;

  const rows = await listChangeRequestsForReviewer({
    ...(status ? { status } : {}),
    ...(registrationWindowId ? { registrationWindowId } : {}),
    take: Number.isFinite(take) ? take : undefined,
  });
  return NextResponse.json(rows);
}
