import { createPrismaClient } from "@/lib/create-prisma-client";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function isStalePrismaClient(client: PrismaClient): boolean {
  // After schema changes (e.g. adding Candidate), a cached dev client may lack new delegates.
  return typeof (client as { candidate?: { findMany?: unknown } }).candidate?.findMany !== "function";
}

function getPrismaClient(): PrismaClient {
  const cached = globalForPrisma.prisma;
  if (cached && !isStalePrismaClient(cached)) {
    return cached;
  }

  const client = createPrismaClient();
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }
  return client;
}

export const prisma = getPrismaClient();
