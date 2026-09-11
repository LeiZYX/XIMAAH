import type { UserRole } from "@/generated/prisma/enums";
import { formatEnglishWithChineseName } from "@/lib/candidates/identity";

export interface AdjustmentSummaryPayload {
  added: Array<{ subject: string; paperCode: string; paperTitle: string }>;
  removed: Array<{ subject: string; paperCode: string; paperTitle: string }>;
  replaced: Array<{
    from: { subject: string; paperCode: string; paperTitle: string };
    to: { subject: string; paperCode: string; paperTitle: string };
  }>;
}

export function parseAdjustmentSummary(raw: string | null | undefined): AdjustmentSummaryPayload {
  if (!raw) {
    return { added: [], removed: [], replaced: [] };
  }
  try {
    const parsed = JSON.parse(raw) as AdjustmentSummaryPayload;
    return {
      added: parsed.added ?? [],
      removed: parsed.removed ?? [],
      replaced: parsed.replaced ?? [],
    };
  } catch {
    return { added: [], removed: [], replaced: [] };
  }
}

export function formatAdjusterLabel(
  name: string | null | undefined,
  role: UserRole | string | null | undefined,
): string {
  if (!name) return "—";
  const roleLabel =
    role === "EXAM_OFFICER"
      ? "Exam Officer"
      : role === "ADMIN"
        ? "Admin"
        : role === "SUBJECT_TEACHER"
          ? "Subject Teacher"
          : role ?? "";
  if (!roleLabel) return name;
  if (name.trim().toLowerCase() === roleLabel.toLowerCase()) return roleLabel;
  return `${name}, ${roleLabel}`;
}

export function workspaceStudentLabel(workspace: {
  student?: { name: string; studentNo?: string | null } | null;
  candidate?: {
    englishName?: string | null;
    chineseName?: string | null;
    studentNumber?: string | null;
  } | null;
  /** Optional; callers may only select `{ id }` — keep `id?` so weak types still assign. */
  registrations?: ReadonlyArray<{
    id?: string;
    studentNameSnapshot?: string | null;
  }>;
}): string {
  const english =
    workspace.student?.name?.trim() ||
    workspace.candidate?.englishName?.trim() ||
    workspace.registrations?.[0]?.studentNameSnapshot?.trim() ||
    "";
  return formatEnglishWithChineseName(english || null, workspace.candidate?.chineseName);
}

export function workspaceStudentNo(workspace: {
  student?: { studentNo?: string | null } | null;
  candidate?: { studentNumber?: string | null } | null;
}): string | null {
  return workspace.student?.studentNo ?? workspace.candidate?.studentNumber ?? null;
}

export function workspacePermanentStudentId(workspace: {
  candidate?: { studentId?: string | null } | null;
}): string | null {
  return workspace.candidate?.studentId?.trim() || null;
}
