import { NextRequest, NextResponse } from "next/server";
import { buildCalendarEvents, parseCalendarSearchParams } from "@/lib/calendar/build-events";
import { getSessionUserFromRequest } from "@/lib/auth/session";
import { jsonError } from "@/lib/api";

export async function GET(request: NextRequest) {
  try {
    const params = parseCalendarSearchParams(request.nextUrl.searchParams);
    const user = await getSessionUserFromRequest(request);
    const studentId = user?.role === "STUDENT" ? user.id : undefined;

    const events = await buildCalendarEvents({ ...params, studentId });
    return NextResponse.json(events);
  } catch (error) {
    console.error("Calendar API error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to load calendar events";
    return jsonError(message, 500);
  }
}
