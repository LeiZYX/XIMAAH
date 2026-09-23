import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import {
  confirmCieAssignment,
  listPendingCieConfirmationsForTeacher,
} from "@/lib/cie/subject-confirmation";
import { RegistrationError } from "@/lib/registrations/errors";
import { prisma } from "@/lib/prisma";
import { RegistrationStatus } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(["SUBJECT_TEACHER", "EXAM_OFFICER", "ADMIN"]);
  if (auth.error) return auth.error;

  try {
    if (auth.user.role === "SUBJECT_TEACHER") {
      const rows = await listPendingCieConfirmationsForTeacher(auth.user.id);
      return NextResponse.json({ pending: rows });
    }

    const registrationWindowId = request.nextUrl.searchParams.get("registrationWindowId");
    const pending = await prisma.cieEntryAssignment.findMany({
      where: {
        status: RegistrationStatus.PENDING_SUBJECT_TEACHER,
        ...(registrationWindowId ? { registrationWindowId } : {}),
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        candidate: {
          select: {
            id: true,
            englishName: true,
            studentNumber: true,
            grade: true,
            className: true,
          },
        },
        registrationWindow: {
          select: { id: true, title: true, academicYear: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ pending });
  } catch (error) {
    if (error instanceof RegistrationError) {
      return jsonError(error.message, error.status);
    }
    throw error;
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(["SUBJECT_TEACHER", "EXAM_OFFICER", "ADMIN"]);
  if (auth.error) return auth.error;

  const body = await request.json();
  const data = parseJsonBody<{
    assignmentId: string;
    approve: boolean;
    reason?: string;
  }>(body, ["assignmentId"]);

  if (!data || typeof data.approve !== "boolean") {
    return jsonError("assignmentId and approve are required");
  }

  try {
    const result = await confirmCieAssignment({
      assignmentId: data.assignmentId,
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
      approve: data.approve,
      reason: data.reason,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof RegistrationError) {
      return jsonError(error.message, error.status);
    }
    throw error;
  }
}
