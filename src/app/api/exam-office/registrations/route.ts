import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import {
  buildRegistrationWhere,
  parseRegistrationFilters,
} from "@/lib/registrations/filters";
import { registrationsToCsv } from "@/lib/registrations/export";
import { registrationInclude } from "@/lib/registrations/service";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  const filters = parseRegistrationFilters(request.nextUrl.searchParams);
  const where = buildRegistrationWhere(filters);
  const format = request.nextUrl.searchParams.get("format");

  const rows = await prisma.studentExamRegistration.findMany({
    where,
    include: registrationInclude,
    orderBy: [{ lockedAt: "desc" }, { updatedAt: "desc" }],
  });

  if (format === "csv") {
    const csv = registrationsToCsv(rows);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="registrations.csv"',
      },
    });
  }

  return NextResponse.json(rows);
}
