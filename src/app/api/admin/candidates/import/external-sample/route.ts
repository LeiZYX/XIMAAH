import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { buildExternalCandidateImportSampleCsv } from "@/lib/candidates/import";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  const csv = buildExternalCandidateImportSampleCsv();
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="external-candidates-import-sample.csv"',
    },
  });
}
