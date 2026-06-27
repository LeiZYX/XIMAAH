import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { listStudentVisibleRegistrations } from "@/lib/registrations/service";

export async function GET() {
  const auth = await requireAuth(["STUDENT"]);
  if (auth.error) return auth.error;

  const registrations = await listStudentVisibleRegistrations(auth.user.id);
  return NextResponse.json(registrations);
}
