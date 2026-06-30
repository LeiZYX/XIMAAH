import type { UserRole } from "@/generated/prisma/enums";
import type { StaffRegistrationInput } from "@/lib/registrations/workflows";
import { applyOfficeOnlyInternalRegistration } from "@/lib/registrations/workflows";

/**
 * Restricted registration for an internal student (RESTRICTED_INTERNAL / REG-RI).
 * Hidden from students and teachers; billed on a separate FS-RI fee statement.
 */
export async function applyRestrictedInternalRegistration(
  performedBy: { id: string; role: UserRole },
  input: StaffRegistrationInput,
) {
  return applyOfficeOnlyInternalRegistration(performedBy, input);
}

export { applyOfficeOnlyInternalRegistration };
