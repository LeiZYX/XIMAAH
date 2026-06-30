import type { UserRole } from "@/generated/prisma/enums";
import {
  applyPostLockAdjustment,
  type PostLockAdjustmentInput,
} from "@/lib/registrations/adjustment";

/**
 * Adjust a locked INTERNAL_NORMAL registration (same workspace / REG-IN).
 * Merges exam changes into the existing student-facing registration.
 */
export async function applyLockedRegistrationAdjustment(
  workspaceId: string,
  performedBy: { id: string; role: UserRole },
  input: PostLockAdjustmentInput,
) {
  return applyPostLockAdjustment(workspaceId, performedBy, input);
}

export { applyPostLockAdjustment, type PostLockAdjustmentInput };
