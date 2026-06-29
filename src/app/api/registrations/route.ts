import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import {
  createStudentRegistration,
  listStudentVisibleRegistrations,
  RegistrationError,
} from "@/lib/registrations/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  const auth = await requireAuth(["STUDENT"]);
  if (auth.error) return auth.error;

  const body = await request.json();
  const data = parseJsonBody<{ examSessionId: string }>(body, ["examSessionId"]);
  if (!data) return jsonError("examSessionId is required");

  try {
    const registration = await createStudentRegistration(auth.user.id, data.examSessionId);
    return NextResponse.json(registration, { status: 201 });
  } catch (error) {
    if (error instanceof RegistrationError) {
      return jsonError(error.message, error.status);
    }
    throw error;
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(["STUDENT"]);
  if (auth.error) return auth.error;

  const status = request.nextUrl.searchParams.get("status") || undefined;
  const registrations = await listStudentVisibleRegistrations(auth.user.id);

  if (status) {
    return NextResponse.json(registrations.filter((row) => row.status === status));
  }

  return NextResponse.json(registrations);
}
