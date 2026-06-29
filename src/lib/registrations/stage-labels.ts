import type { FeeEntryType } from "@/generated/prisma/enums";

export function entryTypeLabel(entryType: FeeEntryType | string | null | undefined): string {
  switch (entryType) {
    case "NORMAL":
      return "Normal Entry";
    case "LATE":
      return "Late Entry";
    case "HIGH_LATE":
      return "High Late Entry";
    default:
      return entryType ? String(entryType) : "—";
  }
}

export const STAGE_CODE_OPTIONS: Array<{ value: FeeEntryType; label: string }> = [
  { value: "NORMAL", label: "Normal Entry" },
  { value: "LATE", label: "Late Entry" },
  { value: "HIGH_LATE", label: "High Late Entry" },
];
