import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canManageRegistrationWindows } from "@/lib/auth/permissions";
import type { PostResultServiceType } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { logPostResultsAudit } from "@/lib/post-results/audit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: Promise<{ id: string }> };

const requestInclude = {
  candidate: {
    select: {
      id: true,
      englishName: true,
      assessmentHubCandidateNumber: true,
      studentNumber: true,
    },
  },
  subject: { select: { id: true, name: true, code: true } },
  paper: { select: { id: true, code: true, title: true } },
  requestedBy: { select: { id: true, name: true } },
  reviewedBy: { select: { id: true, name: true } },
};

export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  const { id: reviewWindowId } = await params;
  const { searchParams } = request.nextUrl;

  const where: Record<string, unknown> = { reviewWindowId };

  const candidateId = searchParams.get("candidateId");
  const subjectId = searchParams.get("subjectId");
  const serviceType = searchParams.get("serviceType");
  const status = searchParams.get("status");

  if (candidateId) where.candidateId = candidateId;
  if (subjectId) where.subjectId = subjectId;
  if (serviceType) where.serviceType = serviceType;
  if (status) where.status = status;

  const requests = await prisma.reviewRequest.findMany({
    where,
    include: requestInclude,
    orderBy: [{ createdAt: "desc" }],
  });

  return NextResponse.json(requests);
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;
  if (!canManageRegistrationWindows(auth.user.role)) {
    return jsonError("Forbidden", 403);
  }

  const { id: reviewWindowId } = await params;
  const window = await prisma.reviewWindow.findUnique({
    where: { id: reviewWindowId },
    include: { services: true },
  });
  if (!window) return jsonError("Review window not found", 404);
  if (window.status === "LOCKED") {
    return jsonError("Cannot create requests in a locked review window", 409);
  }

  const body = await request.json();
  const data = parseJsonBody<{
    candidateId: string;
    serviceType: PostResultServiceType;
    registrationItemId?: string | null;
    examSessionId?: string | null;
    subjectId?: string | null;
    paperId?: string | null;
    reviewType?: string | null;
    priority?: boolean;
    reason?: string | null;
    notes?: string | null;
    status?: string;
  }>(body, ["candidateId", "serviceType"]);

  if (!data) return jsonError("Missing required fields");

  const service = window.services.find((row) => row.serviceType === data.serviceType);
  if (!service?.enabled) {
    return jsonError("This service is not enabled for the review window", 400);
  }

  const candidate = await prisma.candidate.findUnique({ where: { id: data.candidateId } });
  if (!candidate) return jsonError("Candidate not found", 404);

  const created = await prisma.reviewRequest.create({
    data: {
      reviewWindowId,
      candidateId: data.candidateId,
      examBoardId: window.examBoardId,
      examSeriesId: window.examSeriesId,
      registrationItemId: data.registrationItemId ?? undefined,
      examSessionId: data.examSessionId ?? undefined,
      subjectId: data.subjectId ?? undefined,
      paperId: data.paperId ?? undefined,
      serviceType: data.serviceType,
      reviewType: data.reviewType?.trim() || undefined,
      priority: data.priority ?? false,
      status: (data.status as "DRAFT" | "SUBMITTED") ?? "DRAFT",
      requestedByUserId: auth.user.id,
      reason: data.reason?.trim() || undefined,
      notes: data.notes?.trim() || undefined,
    },
    include: requestInclude,
  });

  await logPostResultsAudit({
    action: "REVIEW_REQUEST_CREATED",
    performedByUserId: auth.user.id,
    reviewWindowId,
    candidateId: data.candidateId,
    examBoardId: window.examBoardId,
    examSeriesId: window.examSeriesId,
    serviceType: data.serviceType,
    notes: data.notes ?? undefined,
  });

  return NextResponse.json(created, { status: 201 });
}
