import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { POST_RESULTS_AUDIT_LABELS } from "@/lib/post-results/audit";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  const { id } = await params;
  const window = await prisma.reviewWindow.findUnique({ where: { id } });
  if (!window) return jsonError("Review window not found", 404);

  const logs = await prisma.postResultsAuditLog.findMany({
    where: { reviewWindowId: id },
    include: {
      performedBy: { select: { id: true, name: true } },
    },
    orderBy: { performedAt: "desc" },
    take: 200,
  });

  return NextResponse.json(
    logs.map((log) => ({
      ...log,
      actionLabel: POST_RESULTS_AUDIT_LABELS[log.action],
    })),
  );
}
