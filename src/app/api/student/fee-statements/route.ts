import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canViewStudentFeeStatements } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireAuth(["STUDENT"]);
  if (auth.error) return auth.error;
  if (!canViewStudentFeeStatements(auth.user.role)) {
    return jsonError("Fee statements are not enabled for students", 403);
  }

  const statements = await prisma.feeStatement.findMany({
    where: {
      studentId: auth.user.id,
      status: { in: ["ISSUED", "PAID"] },
    },
    include: {
      items: true,
      registrationWindow: {
        include: {
          examBoard: { select: { name: true, code: true } },
          examSeries: { select: { name: true, year: true } },
        },
      },
    },
    orderBy: [{ issuedAt: "desc" }],
  });

  const sanitized = statements.map((statement) => {
    const { items, ...rest } = statement;
    return {
      ...rest,
      items: items.map(({ costCurrencySnapshot: _c, costAmountSnapshot: _a, markupTypeSnapshot: _m, markupValueSnapshot: _v, ...item }) => item),
    };
  });

  return NextResponse.json(sanitized);
}
