import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { buildCieEntriesCsv, buildCieEntriesPreview } from "@/lib/cie/entries";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  const registrationWindowId = request.nextUrl.searchParams.get("registrationWindowId");
  if (!registrationWindowId) {
    return jsonError("registrationWindowId is required");
  }

  const preview = await buildCieEntriesPreview(registrationWindowId);
  if (!preview) {
    return jsonError("CIE registration window not found", 404);
  }

  const csv = buildCieEntriesCsv(preview);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cie-entries-${registrationWindowId}.csv"`,
    },
  });
}
