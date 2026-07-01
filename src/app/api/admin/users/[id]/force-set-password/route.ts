import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canManageUsers } from "@/lib/auth/permissions";
import { forceSetUserPassword } from "@/lib/auth/force-set-password";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(["ADMIN"]);
  if (auth.error) return auth.error;
  if (!canManageUsers(auth.user.role)) return jsonError("Forbidden", 403);

  const { id } = await params;
  const body = await request.json();
  const data = parseJsonBody<{ password?: string; confirmPassword?: string }>(body, [
    "password",
    "confirmPassword",
  ]);

  if (!data?.password || !data.confirmPassword) {
    return jsonError("password and confirmPassword are required", 400);
  }

  try {
    await forceSetUserPassword({
      userId: id,
      password: data.password,
      confirmPassword: data.confirmPassword,
      performedById: auth.user.id,
    });
    return NextResponse.json({
      ok: true,
      message: "Password has been updated successfully.",
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not set password", 400);
  }
}
