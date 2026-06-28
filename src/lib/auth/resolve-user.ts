import { prisma } from "@/lib/prisma";
import { equalsFilter } from "@/lib/db/string-filters";

function normalizeIdentifier(raw: string): string {
  return raw.trim();
}

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export async function findUserByLoginIdentifier(identifier: string) {
  const value = normalizeIdentifier(identifier);
  if (!value) return null;

  const email = normalizeEmail(value);

  return prisma.user.findFirst({
    where: {
      OR: [
        { email: equalsFilter(email) },
        { username: equalsFilter(value) },
        { phone: value },
        { studentNo: equalsFilter(value) },
      ],
    },
  });
}
