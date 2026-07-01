import { hashPassword } from "@/lib/auth/password";
import { validateAdminSetPassword } from "@/lib/auth/password-policy";
import { logUserAudit } from "@/lib/users/audit";
import { prisma } from "@/lib/prisma";

export async function forceSetUserPassword(input: {
  userId: string;
  password: string;
  confirmPassword: string;
  performedById: string;
}) {
  const validationError = validateAdminSetPassword(input.password, input.confirmPassword);
  if (validationError) {
    throw new Error(validationError);
  }

  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) throw new Error("User not found");

  const passwordHash = await hashPassword(input.password);
  await prisma.user.update({
    where: { id: input.userId },
    data: {
      passwordHash,
      mustChangePassword: false,
    },
  });

  await logUserAudit({
    action: "PASSWORD_FORCE_SET_BY_ADMIN",
    performedById: input.performedById,
    targetUserId: input.userId,
    metadata: {
      timestamp: new Date().toISOString(),
    },
  });

  return user;
}
