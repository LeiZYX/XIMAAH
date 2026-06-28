import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canManageRegistrationWindows } from "@/lib/auth/permissions";
import { lockRegistrationsForWindow } from "@/lib/registrations/lock";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  const { id } = await params;

  const window = await prisma.registrationWindow.findUnique({
    where: { id },
    include: {
      examBoard: { select: { id: true, name: true, code: true } },
      examSeries: { select: { id: true, name: true, year: true } },
    },
  });

  if (!window) return jsonError("Registration window not found", 404);

  return NextResponse.json(window);
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;
  if (!canManageRegistrationWindows(auth.user.role)) {
    return jsonError("Forbidden", 403);
  }

  const { id } = await params;
  const body = await request.json();
  const data = parseJsonBody<{
    title?: string;
    startAt?: string;
    endAt?: string;
    status?: string;
  }>(body, []);

  if (!data) return jsonError("Invalid body");

  const previous = await prisma.registrationWindow.findUnique({ where: { id } });

  const window = await prisma.registrationWindow.update({
    where: { id },
    data: {
      ...(data.title ? { title: data.title } : {}),
      ...(data.startAt ? { startAt: new Date(data.startAt) } : {}),
      ...(data.endAt ? { endAt: new Date(data.endAt) } : {}),
      ...(data.status ? { status: data.status as "DRAFT" | "OPEN" | "CLOSED" } : {}),
    },
    include: {
      examBoard: { select: { id: true, name: true, code: true } },
      examSeries: { select: { id: true, name: true, year: true } },
    },
  });

  if (data.status === "CLOSED" && previous?.status !== "CLOSED") {
    await lockRegistrationsForWindow(window.id, auth.user.id);
  }

  return NextResponse.json(window);
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  const { id } = await params;
  await prisma.registrationWindow.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
