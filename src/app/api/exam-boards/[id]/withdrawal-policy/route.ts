import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canManageRegistrationWindows } from "@/lib/auth/permissions";
import {
  DEFAULT_EXAM_BOARD_WITHDRAWAL_POLICY,
  validateWithdrawalPolicyInput,
  type ExamBoardWithdrawalPolicyInput,
} from "@/lib/fees/withdrawal-policy";
import {
  getExamBoardWithdrawalPolicy,
  upsertExamBoardWithdrawalPolicy,
} from "@/lib/fees/withdrawal-policy-service";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const board = await prisma.examBoard.findUnique({
    where: { id },
    select: { id: true, name: true, code: true },
  });
  if (!board) return jsonError("Exam board not found", 404);

  const policy = await getExamBoardWithdrawalPolicy(id);
  return NextResponse.json({ examBoard: board, policy });
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;
  if (!canManageRegistrationWindows(auth.user.role)) {
    return jsonError("Forbidden", 403);
  }

  const { id } = await context.params;
  const body = (await request.json()) as Partial<ExamBoardWithdrawalPolicyInput>;

  const candidate: ExamBoardWithdrawalPolicyInput = {
    paymentFeePercent:
      body.paymentFeePercent ?? DEFAULT_EXAM_BOARD_WITHDRAWAL_POLICY.paymentFeePercent,
    refundBasis: "SALES_AMOUNT",
    normalRefundEnabled:
      body.normalRefundEnabled ?? DEFAULT_EXAM_BOARD_WITHDRAWAL_POLICY.normalRefundEnabled,
    normalRefundPercent:
      body.normalRefundPercent ?? DEFAULT_EXAM_BOARD_WITHDRAWAL_POLICY.normalRefundPercent,
    lateRefundEnabled:
      body.lateRefundEnabled ?? DEFAULT_EXAM_BOARD_WITHDRAWAL_POLICY.lateRefundEnabled,
    lateRefundPercent:
      body.lateRefundPercent ?? DEFAULT_EXAM_BOARD_WITHDRAWAL_POLICY.lateRefundPercent,
    highLateRefundEnabled:
      body.highLateRefundEnabled ?? DEFAULT_EXAM_BOARD_WITHDRAWAL_POLICY.highLateRefundEnabled,
    highLateRefundPercent:
      body.highLateRefundPercent ?? DEFAULT_EXAM_BOARD_WITHDRAWAL_POLICY.highLateRefundPercent,
    notes: body.notes ?? null,
  };

  const validationError = validateWithdrawalPolicyInput(candidate);
  if (validationError) return jsonError(validationError, 400);

  const policy = await upsertExamBoardWithdrawalPolicy(id, candidate);
  if (!policy) return jsonError("Exam board not found", 404);

  return NextResponse.json({ policy });
}
