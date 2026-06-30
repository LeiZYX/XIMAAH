import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canViewStudentFeeStatements } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { repairDuplicateIssuedFeeStatements } from "@/lib/fees/statement-lifecycle";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const STUDENT_UPDATING_MESSAGE =
  "Your fee statement is currently being updated by the Exams Office. Please wait until the revised statement becomes available.";

function studentFeeStatementWhere(studentUserId: string) {
  return {
    statementKind: "NORMAL" as const,
    studentVisible: true,
    OR: [{ studentId: studentUserId }, { candidate: { userId: studentUserId } }],
  };
}

export async function GET() {
  const auth = await requireAuth(["STUDENT"]);
  if (auth.error) return auth.error;
  if (!canViewStudentFeeStatements(auth.user.role)) {
    return jsonError("Fee statements are not enabled for students", 403);
  }

  const studentWhere = studentFeeStatementWhere(auth.user.id);

  const studentWorkspaces = await prisma.feeStatement.findMany({
    where: studentWhere,
    select: { registrationWorkspaceId: true },
    distinct: ["registrationWorkspaceId"],
  });
  for (const row of studentWorkspaces) {
    if (row.registrationWorkspaceId) {
      await repairDuplicateIssuedFeeStatements(row.registrationWorkspaceId);
    }
  }

  const updatingWorkspaces = await prisma.feeStatement.findMany({
    where: {
      ...studentWhere,
      status: "NEEDS_REGENERATION",
    },
    select: {
      registrationWorkspaceId: true,
      registrationWindow: {
        select: {
          id: true,
          title: true,
          examBoard: { select: { name: true, code: true } },
          examSeries: { select: { name: true, year: true } },
        },
      },
    },
    distinct: ["registrationWorkspaceId"],
  });

  const statements = await prisma.feeStatement.findMany({
    where: {
      ...studentWhere,
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

  const updatingWorkspaceIds = new Set(
    updatingWorkspaces
      .map((row) => row.registrationWorkspaceId)
      .filter((id): id is string => Boolean(id)),
  );

  const sanitized = statements
    .filter(
      (statement) =>
        !statement.registrationWorkspaceId ||
        !updatingWorkspaceIds.has(statement.registrationWorkspaceId),
    )
    .map((statement) => {
      const { items, ...rest } = statement;
      return {
        ...rest,
        items: items.map(
          ({
            costCurrencySnapshot: _c,
            costAmountSnapshot: _a,
            markupTypeSnapshot: _m,
            markupValueSnapshot: _v,
            ...item
          }) => item,
        ),
      };
    });

  const updating = updatingWorkspaces
    .filter((row) => row.registrationWindow)
    .map((row) => ({
      status: "UPDATING" as const,
      message: STUDENT_UPDATING_MESSAGE,
      registrationWindow: row.registrationWindow,
    }));

  return NextResponse.json({
    statements: sanitized,
    updating,
  });
}
