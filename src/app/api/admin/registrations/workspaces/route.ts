import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/prisma";
import { backfillRegistrationWorkspaces } from "@/lib/registrations/workspace";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  await backfillRegistrationWorkspaces();

  const params = request.nextUrl.searchParams;
  const lockedOnly = params.get("lockedOnly") === "true";

  const workspaces = await prisma.registrationWorkspace.findMany({
    where: lockedOnly
      ? {
          OR: [
            { lockedAt: { not: null } },
            { registrations: { some: { status: "LOCKED" } } },
          ],
        }
      : undefined,
    include: {
      student: { select: { name: true, studentNo: true } },
      registrationWindow: {
        include: { examBoard: true, examSeries: true },
      },
      registrations: {
        where: { status: { in: ["ACTIVE", "LOCKED"] } },
        select: { id: true },
      },
      changeRequests: {
        select: { id: true, status: true },
      },
      lastAdjustedByUser: { select: { name: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  return NextResponse.json(workspaces);
}
