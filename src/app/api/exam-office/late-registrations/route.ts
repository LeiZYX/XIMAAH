import { NextRequest, NextResponse } from "next/server";
import type { FeeEntryType } from "@/generated/prisma/enums";
import { jsonError, parseJsonBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { applyStaffStudentRegistrationAfterStudentClose } from "@/lib/registrations/late-registration";
import { RegistrationError } from "@/lib/registrations/errors";

const FEE_ENTRY_TYPES = new Set<FeeEntryType>(["NORMAL", "LATE", "HIGH_LATE"]);

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  const auth = await requireAuth(["EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  const body = await request.json();
  const data = parseJsonBody<{
    studentId?: string;
    registrationWindowId?: string;
    examSessionIds?: string[];
    reason?: string;
    entryTypeOverride?: string;
  }>(body, []);

  if (!data?.studentId || !data.registrationWindowId || !data.reason?.trim()) {
    return jsonError("studentId, registrationWindowId, and reason are required", 400);
  }

  const examSessionIds = Array.isArray(data.examSessionIds) ? data.examSessionIds : [];
  if (examSessionIds.length === 0) {
    return jsonError("At least one exam session must be selected", 400);
  }

  let entryTypeOverride: FeeEntryType | undefined;
  if (data.entryTypeOverride) {
    if (!FEE_ENTRY_TYPES.has(data.entryTypeOverride as FeeEntryType)) {
      return jsonError("entryTypeOverride must be NORMAL, LATE, or HIGH_LATE", 400);
    }
    entryTypeOverride = data.entryTypeOverride as FeeEntryType;
  }

  try {
    const workspace = await applyStaffStudentRegistrationAfterStudentClose(
      { id: auth.user.id, role: auth.user.role },
      {
        studentId: data.studentId,
        registrationWindowId: data.registrationWindowId,
        examSessionIds,
        reason: data.reason.trim(),
        entryTypeOverride,
      },
    );
    return NextResponse.json(workspace, { status: 201 });
  } catch (error) {
    if (error instanceof RegistrationError) {
      return jsonError(error.message, error.status);
    }
    throw error;
  }
}
