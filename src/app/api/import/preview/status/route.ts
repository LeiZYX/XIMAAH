import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { canManageExamData } from "@/lib/auth/permissions";
import { jsonError } from "@/lib/api";
import { checkDataProcessorHealth } from "@/lib/data-processor/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const auth = await requireAuth(["ADMIN"]);
  if (auth.error) return auth.error;
  if (!canManageExamData(auth.user.role)) {
    return jsonError("Forbidden", 403);
  }

  const available = await checkDataProcessorHealth();
  return NextResponse.json({
    available,
    url: process.env.DATA_PROCESSOR_URL ?? null,
  });
}
