import type { CandidateStatus, CandidateType } from "@/generated/prisma/enums";

export function candidateStatusLabel(status: CandidateStatus | string): string {
  switch (status) {
    case "ACTIVE":
      return "Active";
    case "GRADUATED":
      return "Graduated";
    case "LEFT":
      return "Left";
    case "INACTIVE":
      return "Inactive";
    default:
      return String(status);
  }
}

export function candidateTypeLabel(type: CandidateType | string): string {
  return type === "INTERNAL" ? "Internal" : type === "EXTERNAL" ? "External" : String(type);
}
