import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { RegistrationError } from "@/lib/registrations/errors";
import { listAddableSessionsForStudentAdjustment } from "@/lib/registrations/student-adjustment-request";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const auth = await requireAuth(["STUDENT"]);
  if (auth.error) return auth.error;

  const { workspaceId } = await params;
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const limitParam = request.nextUrl.searchParams.get("limit");
  const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : Number.NaN;
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 25;

  try {
    const sessions = await listAddableSessionsForStudentAdjustment({
      studentId: auth.user.id,
      workspaceId,
      q: q || undefined,
      limit,
    });
    return NextResponse.json(sessions);
  } catch (error) {
    if (error instanceof RegistrationError) {
      return jsonError(error.message, error.status);
    }
    throw error;
  }
}
