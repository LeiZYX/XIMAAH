import type { FeeAuditAction, PostResultsAuditAction } from "@/generated/prisma/enums";
import { POST_RESULTS_AUDIT_LABELS } from "@/lib/post-results/audit";
import { prisma } from "@/lib/prisma";

const CASH_IN_POST_RESULTS_ACTIONS: PostResultsAuditAction[] = [
  "CASH_IN_REQUEST_CREATED",
  "CASH_IN_REQUEST_UPDATED",
  "CASH_IN_FEE_MARKED_PAID_OFFLINE",
  "POST_RESULTS_FEE_STATEMENT_GENERATED",
];

const CASH_IN_FEE_ACTIONS: FeeAuditAction[] = [
  "FEE_STATEMENT_MARKED_PAID_OFFLINE",
  "POST_RESULTS_FEE_STATEMENT_GENERATED",
];

export const CASH_IN_FEE_AUDIT_LABELS: Partial<Record<FeeAuditAction, string>> = {
  FEE_STATEMENT_MARKED_PAID_OFFLINE: "Fee statement marked paid offline",
  POST_RESULTS_FEE_STATEMENT_GENERATED: "Post-results fee statement generated",
};

export type CashInAuditSource = "POST_RESULTS" | "FEE";

export interface CashInAuditEntry {
  id: string;
  source: CashInAuditSource;
  action: string;
  actionLabel: string;
  performedAt: string;
  performedByName: string | null;
  details: string | null;
  candidateName: string | null;
  examBoardCode: string | null;
  examSeriesLabel: string | null;
  metadata: Record<string, unknown> | null;
}

function parseMetadata(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function metadataDetail(meta: Record<string, unknown> | null): string | null {
  if (!meta) return null;
  const parts: string[] = [];
  if (typeof meta.statementNo === "string") parts.push(meta.statementNo);
  if (typeof meta.cashInCode === "string") parts.push(`code ${meta.cashInCode}`);
  if (typeof meta.action === "string") parts.push(String(meta.action));
  if (typeof meta.fromStatus === "string" && typeof meta.toStatus === "string") {
    parts.push(`${meta.fromStatus} → ${meta.toStatus}`);
  }
  if (typeof meta.method === "string") parts.push(String(meta.method));
  return parts.length > 0 ? parts.join(" · ") : null;
}

export async function listCashInAuditEntries(limit = 100): Promise<CashInAuditEntry[]> {
  const take = Math.min(Math.max(limit, 1), 300);

  const [postResults, feeLogs] = await Promise.all([
    prisma.postResultsAuditLog.findMany({
      where: {
        OR: [
          { serviceType: "CASH_IN" },
          { action: { in: CASH_IN_POST_RESULTS_ACTIONS } },
        ],
      },
      include: {
        performedBy: { select: { name: true } },
        candidate: {
          select: {
            englishName: true,
            preferredEnglishName: true,
            assessmentHubCandidateNumber: true,
          },
        },
        examBoard: { select: { code: true } },
        examSeries: { select: { name: true, year: true } },
      },
      orderBy: { performedAt: "desc" },
      take,
    }),
    prisma.feeAuditLog.findMany({
      where: { action: { in: CASH_IN_FEE_ACTIONS } },
      include: {
        performedBy: { select: { name: true } },
      },
      orderBy: { performedAt: "desc" },
      take,
    }),
  ]);

  const postEntries: CashInAuditEntry[] = postResults.map((log) => {
    const meta = parseMetadata(log.metadata);
    const candidateName = log.candidate
      ? [
          log.candidate.preferredEnglishName || log.candidate.englishName,
          log.candidate.assessmentHubCandidateNumber,
        ]
          .filter(Boolean)
          .join(" · ")
      : null;
    const detailParts = [
      log.notes,
      log.reason,
      metadataDetail(meta),
    ].filter(Boolean);

    return {
      id: `pr-${log.id}`,
      source: "POST_RESULTS",
      action: log.action,
      actionLabel: POST_RESULTS_AUDIT_LABELS[log.action] ?? log.action,
      performedAt: log.performedAt.toISOString(),
      performedByName: log.performedBy?.name ?? null,
      details: detailParts.length > 0 ? detailParts.join(" · ") : null,
      candidateName,
      examBoardCode: log.examBoard?.code ?? null,
      examSeriesLabel: log.examSeries
        ? `${log.examSeries.name} ${log.examSeries.year}`
        : null,
      metadata: meta,
    };
  });

  const feeEntries: CashInAuditEntry[] = [];
  for (const log of feeLogs) {
    const meta = parseMetadata(log.metadata);
    if (
      log.action === "POST_RESULTS_FEE_STATEMENT_GENERATED" &&
      meta &&
      meta.serviceType &&
      meta.serviceType !== "CASH_IN"
    ) {
      continue;
    }
    const detailParts = [log.note, metadataDetail(meta)].filter(Boolean);
    feeEntries.push({
      id: `fee-${log.id}`,
      source: "FEE",
      action: log.action,
      actionLabel: CASH_IN_FEE_AUDIT_LABELS[log.action] ?? log.action,
      performedAt: log.performedAt.toISOString(),
      performedByName: log.performedBy?.name ?? null,
      details: detailParts.length > 0 ? detailParts.join(" · ") : null,
      candidateName: null,
      examBoardCode: null,
      examSeriesLabel: null,
      metadata: meta,
    });
  }

  return [...postEntries, ...feeEntries]
    .sort((a, b) => b.performedAt.localeCompare(a.performedAt))
    .slice(0, take);
}
