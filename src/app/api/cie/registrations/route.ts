import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import {
  listCieOptionsForWindow,
  previewCieOptionMatch,
  registerCieComposeForStudent,
  registerCieOptionForCandidate,
  registerCieOptionForStudent,
  withdrawCieSyllabusForCandidate,
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
  const auth = await requireAuth(["STUDENT", "SUBJECT_TEACHER", "EXAM_OFFICER", "ADMIN"]);
  if (auth.error) return auth.error;

  const body = await request.json();
  const data = parseJsonBody<{
    action?: "register-option" | "register-compose" | "preview-compose" | "withdraw";
    registrationWindowId: string;
    subjectId?: string;
    syllabusCode?: string;
    optionCode?: string;
    examSessionIds?: string[];
    candidateId?: string;
  }>(body, ["registrationWindowId"]);

  if (!data) return jsonError("Invalid body");

  const action = data.action ?? "register-option";
  const isStaff = auth.user.role !== "STUDENT";
  if (isStaff && !data.candidateId && action !== "preview-compose") {
    return jsonError("candidateId is required for staff CIE registration");
  }

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
      if (isStaff && data.candidateId) {
        const result = await withdrawCieSyllabusForCandidate({
          candidateId: data.candidateId,
          registrationWindowId: data.registrationWindowId,
          syllabusCode: data.syllabusCode,
          asStaff: true,
        });
        return NextResponse.json(result);
      }
      const result = await withdrawCieSyllabusForStudent({
        studentId: auth.user.id,
        registrationWindowId: data.registrationWindowId,
        syllabusCode: data.syllabusCode,
      });
      return NextResponse.json(result);
    }

    if (isStaff && data.candidateId) {
      if (action === "register-compose") {
        if (!data.subjectId || !Array.isArray(data.examSessionIds)) {
          return jsonError("subjectId and examSessionIds are required");
        }
        const result = await registerCieOptionForCandidate({
          candidateId: data.candidateId,
          registrationWindowId: data.registrationWindowId,
          subjectId: data.subjectId,
          optionCode: "",
          actorUserId: auth.user.id,
          actorRole: auth.user.role,
          examSessionIds: data.examSessionIds,
        });
        return NextResponse.json(result, { status: 201 });
      }
      if (!data.optionCode) return jsonError("optionCode is required");
      const result = await registerCieOptionForCandidate({
        candidateId: data.candidateId,
        registrationWindowId: data.registrationWindowId,
        subjectId: data.subjectId,
        syllabusCode: data.syllabusCode,
        optionCode: data.optionCode,
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
      });
      return NextResponse.json(result, { status: 201 });
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
