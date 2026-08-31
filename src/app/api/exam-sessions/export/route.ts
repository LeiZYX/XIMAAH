import * as XLSX from "xlsx";
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canManageExamData } from "@/lib/auth/permissions";
import {
  buildExamSessionListWhere,
  formatExamSessionExportRows,
  listExamSessions,
} from "@/lib/exam-sessions/list";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(["ADMIN"]);
  if (auth.error) return auth.error;
  if (!canManageExamData(auth.user.role)) return jsonError("Forbidden", 403);

  const params = request.nextUrl.searchParams;
  const where = buildExamSessionListWhere({
    examBoardId: params.get("examBoardId"),
    examSeriesId: params.get("examSeriesId"),
    paperId: params.get("paperId"),
    paperQ: params.get("paperQ"),
  });

  const sessions = await listExamSessions({ where });
  const rows = formatExamSessionExportRows(sessions);
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Exam Sessions");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="exam-sessions-${stamp}.xlsx"`,
    },
  });
}
