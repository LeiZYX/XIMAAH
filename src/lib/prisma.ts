import { createPrismaClient } from "@/lib/create-prisma-client";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function isStalePrismaClient(client: PrismaClient): boolean {
  const extended = client as {
    candidate?: { findMany?: unknown };
    registrationFeeStage?: { findMany?: unknown };
    registrationStage?: { findMany?: unknown };
  };

  // After schema changes (e.g. adding Candidate), a cached dev client may lack new delegates.
  if (typeof extended.candidate?.findMany !== "function") {
    return true;
  }

  // Registration window timing refactor: RegistrationStage → RegistrationFeeStage.
  if (typeof extended.registrationFeeStage?.findMany !== "function") {
    return true;
  }
  if (typeof extended.registrationStage?.findMany === "function") {
    return true;
  }

  return false;
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
