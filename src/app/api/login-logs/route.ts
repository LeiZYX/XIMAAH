import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { listLoginLogs } from "@/lib/auth/login-log";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  try {
    const payload = await listLoginLogs(request.nextUrl.searchParams);
    return NextResponse.json(payload);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not load login logs", 500);
  }
}
