import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { buildCalendarEvents, parseCalendarSearchParams } from "@/lib/calendar/build-events";
import { requireAuth } from "@/lib/auth/require-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(["STUDENT"]);
  if (auth.error) return auth.error;

  try {
    const params = parseCalendarSearchParams(request.nextUrl.searchParams);
    const events = await buildCalendarEvents({
      ...params,
      studentId: auth.user.id,
      registeredOnly: true,
      showKeyDates: false,
    });

    return NextResponse.json(events);
  } catch (error) {
    console.error("Calendar my API error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to load calendar events";
    return jsonError(message, 500);
  }
}
