import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { parseRegistrationFilters } from "@/lib/registrations/filters";
import { registrationsToCsv } from "@/lib/registrations/export";
import { listAllRegistrations, listRegistrationsPaginated } from "@/lib/registrations/list";
import { parseListPagination } from "@/lib/pagination";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  const filters = parseRegistrationFilters(request.nextUrl.searchParams);
  const format = request.nextUrl.searchParams.get("format");

  if (format === "csv") {
    const rows = await listAllRegistrations(filters);
    const csv = registrationsToCsv(rows);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="registrations.csv"',
      },
    });
  }

  const { page, pageSize } = parseListPagination(request.nextUrl.searchParams);
  const result = await listRegistrationsPaginated(filters, page, pageSize);
  return NextResponse.json(result);
}
