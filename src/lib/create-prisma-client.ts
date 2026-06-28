import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/generated/prisma/client";

export function createPrismaClient(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  const adapter = new PrismaMariaDb(databaseUrl);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

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
