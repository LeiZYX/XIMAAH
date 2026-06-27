import type { UserRole } from "@/generated/prisma/enums";

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
