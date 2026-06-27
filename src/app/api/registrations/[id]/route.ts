import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import {
  cancelStudentRegistration,
  RegistrationError,
  registrationInclude,
} from "@/lib/registrations/service";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(["STUDENT"]);
  if (auth.error) return auth.error;

  const { id } = await params;

  try {
    const registration = await cancelStudentRegistration(auth.user.id, id);
    return NextResponse.json(registration);
  } catch (error) {
    if (error instanceof RegistrationError) {
      return jsonError(error.message, error.status);
    }
    throw error;
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(["STUDENT", "ADMIN", "EXAM_OFFICER", "SUBJECT_TEACHER"]);
  if (auth.error) return auth.error;

  const { id } = await params;
  const registration = await prisma.studentExamRegistration.findUnique({
    where: { id },
    include: registrationInclude,
  });

  if (!registration) return jsonError("Not found", 404);
  if (auth.user.role === "STUDENT" && registration.studentId !== auth.user.id) {
    return jsonError("Forbidden", 403);
  }

  return NextResponse.json(registration);
}
