import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { markCieEntriesSubmitted } from "@/lib/cie/entries";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  const body = await request.json();
  const data = parseJsonBody<{
    registrationWindowId: string;
    notes?: string | null;
  }>(body, ["registrationWindowId"]);

  if (!data) return jsonError("registrationWindowId is required");

  try {
    const baseline = await markCieEntriesSubmitted({
      registrationWindowId: data.registrationWindowId,
      submittedByUserId: auth.user.id,
      notes: data.notes,
    });
    return NextResponse.json(baseline, { status: 201 });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to mark submitted", 400);
  }
}
