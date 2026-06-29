import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  const { id } = await params;

  const window = await prisma.registrationWindow.findUnique({ where: { id } });
  if (!window) return jsonError("Registration window not found", 404);

  const logs = await prisma.registrationAuditLog.findMany({
    where: { registrationWindowId: id },
    include: {
      performedBy: { select: { name: true, role: true } },
      feeStage: { select: { stageName: true, stageCode: true } },
    },
    orderBy: { performedAt: "desc" },
    take: 200,
  });

  return NextResponse.json(logs);
}
