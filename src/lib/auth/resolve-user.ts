import { prisma } from "@/lib/prisma";

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
        { email: { equals: email, mode: "insensitive" } },
        { username: { equals: value, mode: "insensitive" } },
        { phone: value },
        { studentNo: { equals: value, mode: "insensitive" } },
      ],
    },
  });
}
