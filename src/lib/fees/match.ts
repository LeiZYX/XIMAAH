import type { FeeRuleMatchContext, FeeRuleRecord } from "@/lib/fees/types";

import type { FeeEntryType } from "@/generated/prisma/enums";

const FEE_ENTRY_TYPE_FALLBACKS: Record<FeeEntryType, FeeEntryType[]> = {
  NORMAL: ["NORMAL"],
  LATE: ["LATE", "NORMAL"],
  HIGH_LATE: ["HIGH_LATE", "LATE", "NORMAL"],
};

function ruleMatchesRegistration(rule: FeeRuleRecord, ctx: FeeRuleMatchContext): boolean {
  if (!rule.isActive) return false;
  if (rule.examBoardId !== ctx.examBoardId) return false;
  if (rule.examSeriesId !== ctx.examSeriesId) return false;
  if (rule.qualificationId !== ctx.qualificationId) return false;
  if (rule.entryType !== ctx.entryType) return false;
  if (rule.examSessionId && rule.examSessionId !== ctx.examSessionId) return false;
  if (rule.paperId && rule.paperId !== ctx.paperId) return false;
  if (rule.subjectId && rule.subjectId !== ctx.subjectId) return false;
  return true;
}

export function findMatchingFeeRule(
  rules: FeeRuleRecord[],
  ctx: FeeRuleMatchContext,
): FeeRuleRecord | null {
  const candidates = rules.filter((rule) => ruleMatchesRegistration(rule, ctx));

  const bySession = candidates.filter((rule) => rule.examSessionId === ctx.examSessionId);
  if (bySession.length > 0) return bySession[0];

  const byPaper = candidates.filter(
    (rule) => !rule.examSessionId && rule.paperId === ctx.paperId,
  );
  if (byPaper.length > 0) return byPaper[0];

  const bySubject = candidates.filter(
    (rule) => !rule.examSessionId && !rule.paperId && rule.subjectId === ctx.subjectId,
  );
  if (bySubject.length > 0) return bySubject[0];

  const byQualification = candidates.filter(
    (rule) => !rule.examSessionId && !rule.paperId && !rule.subjectId,
  );
  if (byQualification.length > 0) return byQualification[0];

  return null;
}

/** Match fee rules, falling back to earlier entry stages when a late rule is not configured. */
export function findMatchingFeeRuleWithFallback(
  rules: FeeRuleRecord[],
  ctx: FeeRuleMatchContext,
): FeeRuleRecord | null {
  const entryTypes = FEE_ENTRY_TYPE_FALLBACKS[ctx.entryType] ?? [ctx.entryType];
  for (const entryType of entryTypes) {
    const match = findMatchingFeeRule(rules, { ...ctx, entryType });
    if (match) return match;
  }
  return null;
}

export function resolveEntryTypeForWorkspace(workspace: {
  entryType?: FeeEntryType | null;
  isLateRegistration?: boolean;
}): FeeEntryType {
  if (workspace.entryType) return workspace.entryType;
  return workspace.isLateRegistration ? "LATE" : "NORMAL";
}

export function resolveEntryTypeForRegistration(
  registration: { entryType?: FeeEntryType | null },
  workspace: {
    entryType?: FeeEntryType | null;
    isLateRegistration?: boolean;
  },
): FeeEntryType {
  if (registration.entryType) return registration.entryType;
  return resolveEntryTypeForWorkspace(workspace);
}
