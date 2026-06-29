import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canGenerateFeeStatements } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;
  if (!canGenerateFeeStatements(auth.user.role)) {
    return jsonError("Forbidden", 403);
  }

  const { id: registrationWindowId } = await params;

  const window = await prisma.registrationWindow.findUnique({
    where: { id: registrationWindowId },
    select: {
      id: true,
      title: true,
      status: true,
      examBoard: { select: { code: true } },
      examSeries: { select: { name: true, year: true } },
    },
  });

  if (!window) return jsonError("Registration window not found", 404);

  const [lockedWorkspaces, totalWorkspaces, feeRules, statements] = await Promise.all([
    prisma.registrationWorkspace.count({
      where: { registrationWindowId, lockedAt: { not: null } },
    }),
    prisma.registrationWorkspace.count({
      where: { registrationWindowId },
    }),
    prisma.feeRule.count({
      where: { registrationWindowId, isActive: true },
    }),
    prisma.feeStatement.count({
      where: { registrationWindowId },
    }),
  ]);

  const blockers: string[] = [];
  if (lockedWorkspaces === 0) {
    blockers.push("No locked registration workspaces yet. Lock registrations before generating statements.");
  }
  if (feeRules === 0) {
    blockers.push("No active fee rules configured for this window.");
  }

  return NextResponse.json({
    window,
    lockedWorkspaces,
    totalWorkspaces,
    feeRules,
    statements,
    canGenerate: lockedWorkspaces > 0 && feeRules > 0,
    blockers,
  });
}
