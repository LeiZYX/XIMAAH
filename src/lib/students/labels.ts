import type { StudentProfileStatus } from "@/generated/prisma/enums";

export function studentStatusLabel(status: StudentProfileStatus): string {
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
      return status;
  }
}
