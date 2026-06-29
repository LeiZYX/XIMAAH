import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { parseRegistrationFilters } from "@/lib/registrations/filters";
import { ensureExpiredWindowsLocked } from "@/lib/registrations/lock";
import {
  getTeacherStudentDetail,
  listTeacherStudentSummaries,
} from "@/lib/registrations/teacher-student-list";
import { parseTeacherStudentPagination } from "@/lib/pagination";
import { RegistrationError } from "@/lib/registrations/errors";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(["SUBJECT_TEACHER"]);
  if (auth.error) return auth.error;

  try {
    await ensureExpiredWindowsLocked();

    const filters = parseRegistrationFilters(request.nextUrl.searchParams);
    const studentKey = request.nextUrl.searchParams.get("studentKey");

    if (studentKey) {
      const detail = await getTeacherStudentDetail(studentKey, filters, auth.user.id);
      if (!detail) {
        return jsonError("Student registrations not found", 404);
      }
      return NextResponse.json(detail);
    }

    const { page, pageSize } = parseTeacherStudentPagination(request.nextUrl.searchParams);
    const result = await listTeacherStudentSummaries(filters, page, pageSize, auth.user.id);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof RegistrationError) {
      return jsonError(error.message, error.status);
    }
    if (error instanceof Error && error.message === "Invalid student key") {
      return jsonError(error.message, 400);
    }
    console.error("Teacher student registrations failed:", error);
    return jsonError(
      error instanceof Error ? error.message : "Could not load student registrations",
      500,
    );
  }
}
