import { prisma } from "@/lib/prisma";

let workspaceSchemaReady: boolean | null = null;

export async function hasWorkspaceSchema(): Promise<boolean> {
  if (workspaceSchemaReady !== null) return workspaceSchemaReady;

  try {
    await prisma.$queryRaw`SELECT 1 FROM "RegistrationWorkspace" LIMIT 1`;
    workspaceSchemaReady = true;
  } catch {
    workspaceSchemaReady = false;
  }

  return workspaceSchemaReady;
}

export function resetWorkspaceSchemaCache() {
  workspaceSchemaReady = null;
}
