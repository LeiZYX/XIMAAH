import { RegistrationStatus } from "@/generated/prisma/enums";
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import {
  buildTeacherRegistrationWhere,
  parseRegistrationFilters,
} from "@/lib/registrations/filters";
import { registrationInclude } from "@/lib/registrations/include";
import { ensureExpiredWindowsLocked } from "@/lib/registrations/lock";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(["SUBJECT_TEACHER"]);
  if (auth.error) return auth.error;

  try {
    await ensureExpiredWindowsLocked();

    const filters = parseRegistrationFilters(request.nextUrl.searchParams);
    const where = buildTeacherRegistrationWhere(filters);

    const statusFilter = filters.status
      ? { status: filters.status as "ACTIVE" | "LOCKED" | "CANCELLED" }
      : { status: { in: [RegistrationStatus.ACTIVE, RegistrationStatus.LOCKED] } };

    const rows = await prisma.studentExamRegistration.findMany({
      where: { AND: [where, statusFilter] },
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
