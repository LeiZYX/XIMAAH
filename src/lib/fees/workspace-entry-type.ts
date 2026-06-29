import type { Prisma } from "@/generated/prisma/client";
import type { FeeEntryType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export type WorkspaceEntryTypeRow = {
  id: string;
  isLateRegistration: boolean;
  entryType: FeeEntryType | null;
};

function isMissingEntryTypeFieldError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes("Unknown field `entryType`") &&
    error.message.includes("RegistrationWorkspace")
  );
}

export async function loadWorkspacesWithEntryType(
  where: Prisma.RegistrationWorkspaceWhereInput,
): Promise<WorkspaceEntryTypeRow[]> {
  try {
    return await prisma.registrationWorkspace.findMany({
      where,
      select: { id: true, isLateRegistration: true, entryType: true },
    });
  } catch (error) {
    if (!isMissingEntryTypeFieldError(error)) throw error;

    const rows = await prisma.registrationWorkspace.findMany({
      where,
      select: { id: true, isLateRegistration: true },
    });

    return rows.map((row) => ({ ...row, entryType: null }));
  }
}
