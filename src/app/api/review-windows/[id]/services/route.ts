import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canManageRegistrationWindows } from "@/lib/auth/permissions";
import type { PostResultServiceType } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { logPostResultsAudit } from "@/lib/post-results/audit";
import { CONFIGURABLE_REVIEW_SERVICES } from "@/lib/post-results/constants";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  const { id } = await params;
  const window = await prisma.reviewWindow.findUnique({ where: { id } });
  if (!window) return jsonError("Review window not found", 404);

  const services = await prisma.reviewWindowService.findMany({
    where: { reviewWindowId: id },
    orderBy: { serviceType: "asc" },
  });

  return NextResponse.json(services);
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;
  if (!canManageRegistrationWindows(auth.user.role)) {
    return jsonError("Forbidden", 403);
  }

  const { id } = await params;
  const window = await prisma.reviewWindow.findUnique({
    where: { id },
    include: { examBoard: true, examSeries: true },
  });
  if (!window) return jsonError("Review window not found", 404);
  if (window.status === "LOCKED") {
    return jsonError("Locked review windows cannot be edited", 409);
  }

  const body = await request.json();
  const data = parseJsonBody<{
    services: { serviceType: PostResultServiceType; enabled: boolean; notes?: string | null }[];
  }>(body, ["services"]);

  if (!data || !Array.isArray(data.services)) {
    return jsonError("services array is required");
  }

  for (const item of data.services) {
    if (!CONFIGURABLE_REVIEW_SERVICES.includes(item.serviceType)) {
      return jsonError(`Service type ${item.serviceType} is not configurable`, 400);
    }

    const existing = await prisma.reviewWindowService.findUnique({
      where: {
        reviewWindowId_serviceType: {
          reviewWindowId: id,
          serviceType: item.serviceType,
        },
      },
    });

    if (!existing) continue;

    if (existing.enabled === item.enabled && (item.notes ?? null) === (existing.notes ?? null)) {
      continue;
    }

    await prisma.reviewWindowService.update({
      where: { id: existing.id },
      data: {
        enabled: item.enabled,
        notes: item.notes === null ? null : item.notes?.trim(),
      },
    });

    await logPostResultsAudit({
      action: item.enabled ? "REVIEW_SERVICE_ENABLED" : "REVIEW_SERVICE_DISABLED",
      performedByUserId: auth.user.id,
      reviewWindowId: id,
      examBoardId: window.examBoardId,
      examSeriesId: window.examSeriesId,
      serviceType: item.serviceType,
      notes: item.notes ?? undefined,
    });
  }

  const services = await prisma.reviewWindowService.findMany({
    where: { reviewWindowId: id },
    orderBy: { serviceType: "asc" },
  });

  return NextResponse.json(services);
}
