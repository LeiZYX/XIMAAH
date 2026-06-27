import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import {
  buildTeacherRegistrationWhere,
  parseRegistrationFilters,
} from "@/lib/registrations/filters";
import { registrationInclude } from "@/lib/registrations/include";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(["SUBJECT_TEACHER"]);
  if (auth.error) return auth.error;

  try {
    const filters = parseRegistrationFilters(request.nextUrl.searchParams);
    const where = await buildTeacherRegistrationWhere(auth.user.id, filters);

    const rows = await prisma.studentExamRegistration.findMany({
      where,
      include: registrationInclude,
      orderBy: [
        { examBoard: { name: "asc" } },
        { gradeSnapshot: "asc" },
        { classNameSnapshot: "asc" },
        { subject: { name: "asc" } },
      ],
    });

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Teacher registrations failed:", error);
    return jsonError(
      error instanceof Error ? error.message : "Could not load teacher registrations",
      500,
    );
  }
}
