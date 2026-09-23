import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import {
  listCieOptionsForWindow,
  previewCieOptionMatch,
  registerCieComposeForStudent,
  registerCieOptionForStudent,
  withdrawCieSyllabusForStudent,
} from "@/lib/cie/registration";
import { RegistrationError } from "@/lib/registrations/errors";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(["STUDENT", "SUBJECT_TEACHER", "EXAM_OFFICER", "ADMIN"]);
  if (auth.error) return auth.error;

  const registrationWindowId = request.nextUrl.searchParams.get("registrationWindowId");
  if (!registrationWindowId) {
    return jsonError("registrationWindowId is required");
  }

  try {
    const options = await listCieOptionsForWindow(registrationWindowId);
    return NextResponse.json({ options });
  } catch (error) {
    if (error instanceof RegistrationError) {
      return jsonError(error.message, error.status);
    }
    throw error;
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(["STUDENT"]);
  if (auth.error) return auth.error;

  const body = await request.json();
  const data = parseJsonBody<{
    action?: "register-option" | "register-compose" | "preview-compose" | "withdraw";
    registrationWindowId: string;
    subjectId?: string;
    syllabusCode?: string;
    optionCode?: string;
    examSessionIds?: string[];
  }>(body, ["registrationWindowId"]);

  if (!data) return jsonError("Invalid body");

  const action = data.action ?? "register-option";

  try {
    if (action === "preview-compose") {
      if (!data.subjectId || !Array.isArray(data.examSessionIds)) {
        return jsonError("subjectId and examSessionIds are required");
      }
      const preview = await previewCieOptionMatch({
        registrationWindowId: data.registrationWindowId,
        subjectId: data.subjectId,
        examSessionIds: data.examSessionIds,
      });
      return NextResponse.json(preview);
    }

    if (action === "withdraw") {
      if (!data.syllabusCode) return jsonError("syllabusCode is required");
      const result = await withdrawCieSyllabusForStudent({
        studentId: auth.user.id,
        registrationWindowId: data.registrationWindowId,
        syllabusCode: data.syllabusCode,
      });
      return NextResponse.json(result);
    }

    if (action === "register-compose") {
      if (!data.subjectId || !Array.isArray(data.examSessionIds)) {
        return jsonError("subjectId and examSessionIds are required");
      }
      const result = await registerCieComposeForStudent({
        studentId: auth.user.id,
        registrationWindowId: data.registrationWindowId,
        subjectId: data.subjectId,
        examSessionIds: data.examSessionIds,
      });
      return NextResponse.json(result, { status: 201 });
    }

    if (!data.optionCode) return jsonError("optionCode is required");
    const result = await registerCieOptionForStudent({
      studentId: auth.user.id,
      registrationWindowId: data.registrationWindowId,
      subjectId: data.subjectId,
      syllabusCode: data.syllabusCode,
      optionCode: data.optionCode,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof RegistrationError) {
      return jsonError(error.message, error.status);
    }
    throw error;
  }
}
