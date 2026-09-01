import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_EXAM_BOARD_WITHDRAWAL_POLICY,
  normalizeWithdrawalPolicyInput,
  serializeWithdrawalPolicy,
  type ExamBoardWithdrawalPolicyInput,
} from "@/lib/fees/withdrawal-policy";

type Tx = Prisma.TransactionClient | typeof prisma;

export async function ensureExamBoardWithdrawalPolicy(
  examBoardId: string,
  tx: Tx = prisma,
) {
  const existing = await tx.examBoardWithdrawalPolicy.findUnique({
    where: { examBoardId },
  });
  if (existing) return existing;

  const defaults = normalizeWithdrawalPolicyInput(DEFAULT_EXAM_BOARD_WITHDRAWAL_POLICY);
  return tx.examBoardWithdrawalPolicy.create({
    data: {
      examBoardId,
      ...defaults,
    },
  });
}

export async function getExamBoardWithdrawalPolicy(examBoardId: string) {
  const policy = await ensureExamBoardWithdrawalPolicy(examBoardId);
  return serializeWithdrawalPolicy(policy);
}

export async function upsertExamBoardWithdrawalPolicy(
  examBoardId: string,
  input: ExamBoardWithdrawalPolicyInput,
) {
  const board = await prisma.examBoard.findUnique({
    where: { id: examBoardId },
    select: { id: true },
  });
  if (!board) return null;

  const data = normalizeWithdrawalPolicyInput(input);
  const policy = await prisma.examBoardWithdrawalPolicy.upsert({
    where: { examBoardId },
    create: { examBoardId, ...data },
    update: data,
  });
  return serializeWithdrawalPolicy(policy);
}

export async function loadWithdrawalPolicyForBoard(
  examBoardId: string,
  tx: Tx = prisma,
): Promise<ExamBoardWithdrawalPolicyInput> {
  const policy = await ensureExamBoardWithdrawalPolicy(examBoardId, tx);
  return normalizeWithdrawalPolicyInput({
    paymentFeePercent: Number(policy.paymentFeePercent),
    refundBasis: policy.refundBasis,
    normalRefundEnabled: policy.normalRefundEnabled,
    normalRefundPercent: Number(policy.normalRefundPercent),
    lateRefundEnabled: policy.lateRefundEnabled,
    lateRefundPercent: Number(policy.lateRefundPercent),
    highLateRefundEnabled: policy.highLateRefundEnabled,
    highLateRefundPercent: Number(policy.highLateRefundPercent),
    notes: policy.notes,
  });
}
