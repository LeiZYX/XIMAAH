import type { UserRole } from "@/generated/prisma/enums";
import type { StaffRegistrationInput } from "@/lib/registrations/workflows";
import { applyAssistedRegistration } from "@/lib/registrations/workflows";

/**
 * Register on behalf of an internal student (INTERNAL_NORMAL / REG-IN).
 * EO and Admin share the same workflow; source and audit action vary by role.
 */
export async function applyInternalAssistedRegistration(
  performedBy: { id: string; role: UserRole },
  input: StaffRegistrationInput,
) {
  return applyAssistedRegistration(performedBy, input);
}

export { applyAssistedRegistration };
