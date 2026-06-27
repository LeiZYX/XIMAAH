import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import {
  buildRegistrationWhere,
  parseRegistrationFilters,
} from "@/lib/registrations/filters";
import { registrationsToCsv } from "@/lib/registrations/export";
import { registrationInclude } from "@/lib/registrations/service";
import { prisma } from "@/lib/prisma";

async function listRegistrations(request: NextRequest) {
  const filters = parseRegistrationFilters(request.nextUrl.searchParams);
  const where = buildRegistrationWhere(filters);

  return prisma.studentExamRegistration.findMany({
    where,
    include: registrationInclude,
    orderBy: [{ lockedAt: "desc" }, { updatedAt: "desc" }],
  });
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(["ADMIN"]);
  if (auth.error) return auth.error;

  const format = request.nextUrl.searchParams.get("format");
  const rows = await listRegistrations(request);

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
