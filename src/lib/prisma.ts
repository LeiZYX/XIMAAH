import { statSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaFingerprint?: number;
};

function generatedClientFingerprint(): number {
  try {
    return statSync(join(process.cwd(), "src/generated/prisma/index.js")).mtimeMs;
  } catch {
    return 0;
  }
}

function createPrismaClient() {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["error"],
  });
}

function getPrismaClient(): PrismaClient {
  if (process.env.NODE_ENV === "production") {
    if (!globalForPrisma.prisma) {
      globalForPrisma.prisma = createPrismaClient();
    }
    return globalForPrisma.prisma;
  }

  const fingerprint = generatedClientFingerprint();
  if (
    !globalForPrisma.prisma ||
    globalForPrisma.prismaFingerprint !== fingerprint
  ) {
    if (globalForPrisma.prisma) {
      void globalForPrisma.prisma.$disconnect();
    }
    globalForPrisma.prisma = createPrismaClient();
    globalForPrisma.prismaFingerprint = fingerprint;
  }

  return globalForPrisma.prisma;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrismaClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export async function disconnectPrismaClient(client: PrismaClient) {
  await Promise.race([
    client.$disconnect(),
    new Promise<void>((resolve) => {
      setTimeout(resolve, 2_000);
    }),
  ]);
}

export async function exitAfterPrismaScript(client: PrismaClient, code: number) {
  await disconnectPrismaClient(client);
  process.exit(code);
}
