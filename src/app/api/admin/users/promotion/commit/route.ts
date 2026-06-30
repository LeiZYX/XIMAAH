import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canManageUsers } from "@/lib/auth/permissions";
import { commitClassPromotion } from "@/lib/users/promotion";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  const auth = await requireAuth(["ADMIN"]);
  if (auth.error) return auth.error;
  if (!canManageUsers(auth.user.role)) return jsonError("Forbidden", 403);

  const body = await request.json();
  const data = parseJsonBody<{
    sourceGrade: string;
    sourceClassName?: string;
    targetGrade?: string;
    targetClassName?: string;
    archiveStatus?: "ACTIVE" | "GRADUATED" | "LEFT" | "INACTIVE";
    studentIds: string[];
  }>(body, ["sourceGrade", "studentIds"]);

  if (!data?.studentIds?.length) return jsonError("studentIds are required");

  try {
    const result = await commitClassPromotion(auth.user.id, data);
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Promotion failed", 400);
  }
}
