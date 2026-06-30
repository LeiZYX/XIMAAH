import type { UserRole } from "@/generated/prisma/enums";
import type { ExternalCandidateRegistrationInput } from "@/lib/registrations/workflows";
import { applyExternalCandidateRegistration } from "@/lib/registrations/workflows";

/**
 * Register an external candidate (EXTERNAL / REG-EX).
 * Hidden from students and teachers; billed on a separate FS-EX fee statement.
 */
export async function registerExternalCandidate(
  performedBy: { id: string; role: UserRole },
  input: ExternalCandidateRegistrationInput,
) {
  return applyExternalCandidateRegistration(performedBy, input);
}

export { applyExternalCandidateRegistration };
