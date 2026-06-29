import { Prisma } from "@/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function prismaErrorMessage(error: unknown, code: string): string | null {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return `Exam board code "${code}" already exists. Edit the existing row or use a different code (e.g. OCR, CIE).`;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
    return "Database tables are missing. Run: npm run db:migrate";
  }

  if (error instanceof Error && error.message.includes("ECONNREFUSED")) {
    return "Cannot connect to MySQL. Start the database first.";
  }

  return null;
}

export async function GET() {
  try {
    const examBoards = await prisma.examBoard.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { qualifications: true, examSeries: true },
        },
      },
    });
    return NextResponse.json(examBoards);
  } catch (error) {
    const message = prismaErrorMessage(error, "") ?? "Failed to load exam boards";
    return jsonError(message, 500);
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const data = parseJsonBody<{
    name: string;
    code: string;
    country: string;
    description?: string;
    region?: string;
    website?: string;
    timezone?: string;
  }>(body, ["name", "code", "country"]);

  if (!data) {
    return jsonError("Name, code, and country are required");
  }

  const code = String(data.code).toUpperCase().trim();

  if (!code) {
    return jsonError("Code cannot be empty");
  }

  try {
    const existing = await prisma.examBoard.findUnique({ where: { code } });
    if (existing) {
      return jsonError(
        `Code "${code}" is already used by "${existing.name}". Click Edit on that row instead.`,
        409,
      );
    }

    const examBoard = await prisma.examBoard.create({
      data: {
        name: data.name.trim(),
        code,
        country: String(data.country).toUpperCase().trim(),
        description: data.description ? String(data.description) : null,
        region: data.region ? String(data.region) : null,
        website: data.website ? String(data.website) : null,
        timezone: data.timezone ? String(data.timezone) : null,
      },
    });
    return NextResponse.json(examBoard, { status: 201 });
  } catch (error) {
    const message =
      prismaErrorMessage(error, code) ??
      (error instanceof Error ? error.message : "Could not create exam board");
    return jsonError(message, 409);
  }
}
