import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { submitAmendmentBaseline } from "@/lib/board-submissions/amendment/submit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => null);
  const data = parseJsonBody<{ registrationWindowId?: string; notes?: string }>(body, [
    "registrationWindowId",
  ]);
  if (!data?.registrationWindowId) {
    return jsonError("registrationWindowId is required", 400);
  }

  try {
    const result = await submitAmendmentBaseline({
      registrationWindowId: data.registrationWindowId,
      submittedByUserId: auth.user.id,
      notes: data.notes,
    });
    return NextResponse.json({
      baseline: {
        id: result.baseline.id,
        version: result.baseline.version,
        kind: result.baseline.kind,
        submittedAt: result.baseline.submittedAt.toISOString(),
        submittedByName: result.baseline.submittedBy?.name ?? null,
        candidateCount: result.baseline.candidateCount,
        entryCount: result.baseline.entryCount,
        fileCount: result.baseline.fileCount,
      },
    });
  } catch (error) {
    console.error("Amendment submit error:", error);
    return jsonError(
      error instanceof Error ? error.message : "Failed to mark amendment as submitted",
      400,
    );
  }
}
