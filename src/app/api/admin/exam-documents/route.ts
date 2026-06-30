import { NextRequest } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canAccessExamOffice } from "@/lib/auth/permissions";
import {
  handleExamDocumentsGet,
  handleExamDocumentsPost,
} from "@/lib/exam-documents/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;
  if (!canAccessExamOffice(auth.user.role)) return jsonError("Forbidden", 403);
  try {
    return await handleExamDocumentsGet(request);
  } catch (error) {
    console.error("GET /api/admin/exam-documents failed:", error);
    return jsonError(error instanceof Error ? error.message : "Failed to load document", 500);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;
  if (!canAccessExamOffice(auth.user.role)) return jsonError("Forbidden", 403);

  const action = request.nextUrl.searchParams.get("action");
  const mode =
    action === "print" ? "print" : action === "download" ? "download" : "preview";

  try {
    return await handleExamDocumentsPost(request, auth.user.id, mode);
  } catch (error) {
    console.error("POST /api/admin/exam-documents failed:", error);
    return jsonError(error instanceof Error ? error.message : "Document action failed", 500);
  }
}
