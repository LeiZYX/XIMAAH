import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canManageExamData } from "@/lib/auth/permissions";
import {
  StudentArchiveError,
  graduateStudent,
  leaveStudent,
  markStudentInactive,
  reactivateStudent,
} from "@/lib/students/archive";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(["ADMIN"]);
  if (auth.error) return auth.error;
  if (!canManageExamData(auth.user.role)) {
    return jsonError("Forbidden", 403);
  }

  const { id } = await params;
  const body = await request.json();
  const data = parseJsonBody<{ action: string; graduationYear?: number }>(body, ["action"]);
  if (!data) return jsonError("action is required");

  try {
    switch (data.action) {
      case "graduate":
        await graduateStudent(id, data.graduationYear);
        break;
      case "leave":
        await leaveStudent(id);
        break;
      case "inactive":
        await markStudentInactive(id);
        break;
      case "reactivate":
        await reactivateStudent(id);
        break;
      default:
        return jsonError("Unknown action");
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof StudentArchiveError) {
      return jsonError(error.message, error.status);
    }
    throw error;
  }
}
