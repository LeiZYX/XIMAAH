import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canGenerateFeeStatements } from "@/lib/auth/permissions";
import { createFeeAuditLog } from "@/lib/fees/audit";
import {
  FeeError,
  generateFeeStatement,
  issueFeeStatement,
  regenerateRevisedFeeStatement,
  validateWorkspaceFees,
} from "@/lib/fees/statement";
import { repriceWorkspaceByCurrentFeeStage } from "@/lib/fees/reprice-by-current-stage";
import {
  hasIssuedFeeStatement,
  needsFeeStatementRegeneration,
} from "@/lib/fees/workspace-status";
import { repairDuplicateIssuedFeeStatements } from "@/lib/fees/statement-lifecycle";
import { DEFAULT_FEE_STATEMENT_DISPLAY_CURRENCY } from "@/lib/fees/display-currency";
import {
  findLockedWorkspacesForBilling,
  shouldRegenerateFeeStatement,
} from "@/lib/fees/billing-workspaces";
import { generateExternalInvoice, generateRestrictedInvoice } from "@/lib/fees/restricted-invoice";
import { markFeeStatementPaidOffline } from "@/lib/fees/mark-paid-offline";
import { buildPaginationMeta, parseListPagination } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import type { FeeStatementKind } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

function pinyinLikePattern(value: string): string {
  return `%${value.replace(/[%_\\]/g, "\\$&")}%`;
}

/** Match surname+given pinyin with or without spaces, e.g. "gong hao" and "gonghao". */
async function candidateIdsMatchingPinyin(query: string): Promise<string[]> {
  const compact = query.replace(/\s+/g, "");
  if (!/^[a-z0-9]+$/i.test(compact)) return [];
  const pattern = pinyinLikePattern(compact.toLowerCase());
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM Candidate
    WHERE LOWER(REPLACE(CONCAT(IFNULL(surnamePinyin, ''), IFNULL(givenNamePinyin, '')), ' ', '')) LIKE ${pattern}
       OR LOWER(REPLACE(CONCAT(IFNULL(givenNamePinyin, ''), IFNULL(surnamePinyin, '')), ' ', '')) LIKE ${pattern}
       OR LOWER(REPLACE(IFNULL(surnamePinyin, ''), ' ', '')) LIKE ${pattern}
       OR LOWER(REPLACE(IFNULL(givenNamePinyin, ''), ' ', '')) LIKE ${pattern}
       OR LOWER(REPLACE(CONCAT(IFNULL(lastName, ''), IFNULL(firstName, '')), ' ', '')) LIKE ${pattern}
       OR LOWER(REPLACE(CONCAT(IFNULL(firstName, ''), IFNULL(lastName, '')), ' ', '')) LIKE ${pattern}
  `;
  return rows.map((row) => row.id);
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function runOfficeInvoiceBatch(input: {
  registrationWindowId: string;
  registrationType: "RESTRICTED_INTERNAL" | "EXTERNAL";
  statementKind: FeeStatementKind;
  generatedByUserId: string;
  displayCurrency: "GBP" | "CNY" | "BOTH";
  issue: boolean;
  generate: (params: {
    workspaceId: string;
    generatedByUserId: string;
    displayCurrency: "GBP" | "CNY" | "BOTH";
    issue?: boolean;
  }) => Promise<{ id: string }>;
}) {
  const workspaces = await findLockedWorkspacesForBilling(
    input.registrationWindowId,
    input.registrationType,
  );

  const results: {
    workspaceId: string;
    ok: boolean;
    error?: string;
    statementId?: string;
    skipped?: boolean;
  }[] = [];

  for (const workspace of workspaces) {
    try {
      const existingDraft = await prisma.feeStatement.findFirst({
        where: {
          registrationWorkspaceId: workspace.id,
          statementKind: input.statementKind,
          status: "DRAFT",
        },
        select: { id: true },
      });
      if (!input.issue && existingDraft) {
        results.push({
          workspaceId: workspace.id,
          ok: true,
          statementId: existingDraft.id,
          skipped: true,
        });
        continue;
      }

      const existingIssued = await prisma.feeStatement.findFirst({
        where: {
          registrationWorkspaceId: workspace.id,
          statementKind: input.statementKind,
          status: { in: ["ISSUED", "PAID"] },
        },
        select: { id: true },
      });
      if (existingIssued) {
        results.push({
          workspaceId: workspace.id,
          ok: true,
          statementId: existingIssued.id,
          skipped: true,
        });
        continue;
      }

      const invoice = await input.generate({
        workspaceId: workspace.id,
        generatedByUserId: input.generatedByUserId,
        displayCurrency: input.displayCurrency,
        issue: input.issue,
      });
      results.push({ workspaceId: workspace.id, ok: true, statementId: invoice.id });
    } catch (error) {
      results.push({
        workspaceId: workspace.id,
        ok: false,
        error: error instanceof FeeError ? error.message : "Invoice generation failed",
      });
    }
  }

  return results;
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;
  if (!canGenerateFeeStatements(auth.user.role)) {
    return jsonError("Forbidden", 403);
  }

  const params = request.nextUrl.searchParams;
  const registrationWindowId = params.get("registrationWindowId");
  const workspaceId = params.get("workspaceId");
  const statementId = params.get("statementId");
  const all = params.get("all") === "true";

  const statementInclude = {
    items: true,
    generatedBy: { select: { id: true, name: true } },
    regenerationChangedBy: { select: { id: true, name: true } },
    revisedFromStatement: { select: { id: true, statementNo: true, status: true } },
    revisedToStatement: { select: { id: true, statementNo: true, status: true } },
    candidate: {
      select: {
        studentId: true,
        chineseName: true,
        examIdentities: {
          select: {
            centreNumber: true,
            uciNumber: true,
            examBoardId: true,
            examBoard: { select: { id: true, code: true } },
          },
        },
      },
    },
    registrationWorkspace: {
      select: {
        uciAtEntry: true,
      },
    },
    paymentOrders: {
      include: { cancelledBy: { select: { id: true, name: true } } },
      orderBy: [{ version: "desc" as const }, { createdAt: "desc" as const }],
    },
    registrationWindow: {
      include: {
        examBoard: { select: { id: true, name: true, code: true } },
        examSeries: { select: { name: true, year: true } },
      },
    },
  };

  const statementKindParam = params.get("statementKind");
  const statementKind: FeeStatementKind | undefined =
    statementKindParam === "RESTRICTED" ||
    statementKindParam === "NORMAL" ||
    statementKindParam === "EXTERNAL"
      ? statementKindParam
      : registrationWindowId && !all
        ? "NORMAL"
        : undefined;

  const includeSuperseded = params.get("includeSuperseded") === "true";
  const paymentStatus = params.get("paymentStatus"); // unpaid | paid | all
  const query = params.get("q")?.trim();
  const pinyinCandidateIds = query ? await candidateIdsMatchingPinyin(query) : [];

  const where: Prisma.FeeStatementWhereInput = {
    ...(registrationWindowId ? { registrationWindowId } : {}),
    ...(workspaceId ? { registrationWorkspaceId: workspaceId } : {}),
    ...(statementKind ? { statementKind } : {}),
    ...(!includeSuperseded ? { status: { notIn: ["REVISED", "CANCELLED"] } } : {}),
    ...(query
      ? {
          OR: [
            { statementNo: { contains: query } },
            { studentNameSnapshot: { contains: query } },
            { studentNoSnapshot: { contains: query } },
            { candidate: { is: { chineseName: { contains: query } } } },
            { candidate: { is: { surnamePinyin: { contains: query } } } },
            { candidate: { is: { givenNamePinyin: { contains: query } } } },
            { candidate: { is: { firstName: { contains: query } } } },
            { candidate: { is: { lastName: { contains: query } } } },
            { candidate: { is: { preferredEnglishName: { contains: query } } } },
            ...(pinyinCandidateIds.length > 0
              ? [{ candidateId: { in: pinyinCandidateIds } }]
              : []),
          ],
        }
      : {}),
  };

  if (paymentStatus === "paid") {
    where.status = "PAID";
  } else if (paymentStatus === "unpaid") {
    where.status = "ISSUED";
  }

  if (statementId) {
    const statement = await prisma.feeStatement.findUnique({
      where: { id: statementId },
      include: statementInclude,
    });
    if (!statement) {
      return jsonError("Fee statement not found", 404);
    }
    return NextResponse.json({ statements: [statement] });
  }

  if (workspaceId) {
    await repairDuplicateIssuedFeeStatements(workspaceId);

    const statements = await prisma.feeStatement.findMany({
      where,
      include: statementInclude,
      orderBy: [{ generatedAt: "desc" }],
    });
    const workspace = await prisma.registrationWorkspace.findUnique({
      where: { id: workspaceId },
      select: { lastAdjustedAt: true },
    });

    const outdated = statements.find((row) => row.status === "NEEDS_REGENERATION");

    const meta = {
      needsRegeneration: needsFeeStatementRegeneration(statements, workspace?.lastAdjustedAt ?? null),
      hasIssuedStatement: hasIssuedFeeStatement(statements),
      lastAdjustedAt: workspace?.lastAdjustedAt?.toISOString() ?? null,
      outdatedStatement: outdated
        ? {
            id: outdated.id,
            statementNo: outdated.statementNo,
            status: outdated.status,
            generatedAt: outdated.generatedAt,
            regenerationReason: outdated.regenerationReason,
            regenerationChangedAt: outdated.regenerationChangedAt,
            regenerationChangedBy: outdated.regenerationChangedBy,
          }
        : null,
    };

    return NextResponse.json({ statements, meta });
  }

  if (registrationWindowId && all) {
    const statements = await prisma.feeStatement.findMany({
      where: {
        registrationWindowId,
        ...(statementKindParam === "RESTRICTED" ||
        statementKindParam === "NORMAL" ||
        statementKindParam === "EXTERNAL"
          ? { statementKind: statementKindParam }
          : {}),
        ...(!includeSuperseded ? { status: { notIn: ["REVISED", "CANCELLED"] } } : {}),
      },
      include: statementInclude,
      orderBy: [{ generatedAt: "desc" }],
      take: 500,
    });
    return NextResponse.json(statements);
  }

  if (registrationWindowId) {
    const { page, pageSize } = parseListPagination(params);
    const total = await prisma.feeStatement.count({ where });
    const { skip, page: safePage, totalPages, pageSize: safePageSize } = buildPaginationMeta(
      total,
      page,
      pageSize,
    );
    const statements = await prisma.feeStatement.findMany({
      where,
      include: statementInclude,
      orderBy: [{ generatedAt: "desc" }],
      skip,
      take: safePageSize,
    });
    return NextResponse.json({
      statements,
      total,
      page: safePage,
      totalPages,
      pageSize: safePageSize,
    });
  }

  const statements = await prisma.feeStatement.findMany({
    where,
    include: statementInclude,
    orderBy: [{ generatedAt: "desc" }],
    take: 200,
  });
  return NextResponse.json(statements);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;
  if (!canGenerateFeeStatements(auth.user.role)) {
    return jsonError("Forbidden", 403);
  }

  const body = await request.json().catch(() => null);
  if (!body) return jsonError("Invalid JSON body", 400);
  const data = parseJsonBody<{
    workspaceId?: string;
    registrationWindowId?: string;
    displayCurrency?: string;
    issue?: boolean;
    regenerate?: boolean;
    action?: string;
    statementId?: string;
    batchKind?: string;
    note?: string;
  }>(body, []);

  if (!data) return jsonError("Invalid body");

  try {
    if (data.action === "issue" && data.statementId) {
      const statement = await issueFeeStatement(data.statementId, {
        performedByUserId: auth.user.id,
      });
      return NextResponse.json(statement);
    }

    if (data.action === "mark-paid-offline" && data.statementId) {
      const result = await markFeeStatementPaidOffline({
        statementId: data.statementId,
        performedByUserId: auth.user.id,
        note: data.note,
        source: "FEE_STATEMENTS_BATCH",
      });

      if (!result.alreadyPaid) {
        const { queueFeeStatementPaidNotification } = await import(
          "@/lib/notifications/fee-statement-paid"
        );
        queueFeeStatementPaidNotification(result.statementId);
      }

      return NextResponse.json(result);
    }

    if (data.action === "validate" && data.workspaceId) {
      const result = await validateWorkspaceFees(data.workspaceId);
      return NextResponse.json(result);
    }

    if (data.action === "batch" && data.registrationWindowId) {
      const workspaces = await findLockedWorkspacesForBilling(
        data.registrationWindowId,
        "INTERNAL_NORMAL",
      );

      const results: {
        workspaceId: string;
        ok: boolean;
        error?: string;
        statementId?: string;
        skipped?: boolean;
      }[] = [];

      for (const workspace of workspaces) {
        try {
          const autoRegenerate =
            Boolean(data.regenerate) ||
            (await shouldRegenerateFeeStatement(workspace.id, "NORMAL"));

          if (!autoRegenerate) {
            const existingDraft = await prisma.feeStatement.findFirst({
              where: {
                registrationWorkspaceId: workspace.id,
                statementKind: "NORMAL",
                status: "DRAFT",
              },
              select: { id: true },
            });
            if (existingDraft && !data.issue) {
              results.push({
                workspaceId: workspace.id,
                ok: true,
                statementId: existingDraft.id,
                skipped: true,
              });
              continue;
            }

            if (existingDraft && data.issue) {
              const validation = await validateWorkspaceFees(workspace.id);
              if (!validation.canGenerate) {
                results.push({
                  workspaceId: workspace.id,
                  ok: false,
                  error: `Missing fee rules (${validation.warnings.length})`,
                });
                continue;
              }
              const issued = await issueFeeStatement(existingDraft.id, {
                performedByUserId: auth.user.id,
              });
              results.push({
                workspaceId: workspace.id,
                ok: true,
                statementId: issued.id,
              });
              continue;
            }

            const existingIssued = await prisma.feeStatement.findFirst({
              where: {
                registrationWorkspaceId: workspace.id,
                statementKind: "NORMAL",
                status: { in: ["ISSUED", "PAID"] },
              },
              select: { id: true },
            });
            if (existingIssued && !data.issue) {
              results.push({
                workspaceId: workspace.id,
                ok: false,
                error: "Issued statement already exists. Use regenerate to revise.",
              });
              continue;
            }
          }

          const validation = await validateWorkspaceFees(workspace.id);
          if (!validation.canGenerate) {
            results.push({
              workspaceId: workspace.id,
              ok: false,
              error: `Missing fee rules (${validation.warnings.length})`,
            });
            continue;
          }

          const statement = await generateFeeStatement({
            workspaceId: workspace.id,
            generatedByUserId: auth.user.id,
            displayCurrency:
              (data.displayCurrency as "GBP" | "CNY" | "BOTH") ?? DEFAULT_FEE_STATEMENT_DISPLAY_CURRENCY,
            issue: Boolean(data.issue),
            regenerate: autoRegenerate,
          });
          results.push({ workspaceId: workspace.id, ok: true, statementId: statement.id });
        } catch (error) {
          results.push({
            workspaceId: workspace.id,
            ok: false,
            error: error instanceof FeeError ? error.message : "Generation failed",
          });
        }
      }

      try {
        await createFeeAuditLog({
          action: "FEE_STATEMENT_BATCH_GENERATED",
          performedByUserId: auth.user.id,
          registrationWindowId: data.registrationWindowId,
          metadata: { results, issue: Boolean(data.issue), regenerate: Boolean(data.regenerate) },
        });
      } catch (auditError) {
        console.error("Fee audit log failed:", auditError);
      }

      return NextResponse.json({ results });
    }

    if (data.action === "batch-reprice-by-current-fee-stage" && data.registrationWindowId) {
      const workspaces = await findLockedWorkspacesForBilling(
        data.registrationWindowId,
        "INTERNAL_NORMAL",
      );

      const results: {
        workspaceId: string;
        ok: boolean;
        error?: string;
        statementId?: string;
        targetStageLabel?: string;
        changedCount?: number;
        skippedOverriddenCount?: number;
        defaultedToNormal?: boolean;
      }[] = [];

      for (const workspace of workspaces) {
        try {
          const result = await repriceWorkspaceByCurrentFeeStage({
            workspaceId: workspace.id,
            performedByUserId: auth.user.id,
            displayCurrency:
              (data.displayCurrency as "GBP" | "CNY" | "BOTH") ??
              DEFAULT_FEE_STATEMENT_DISPLAY_CURRENCY,
          });
          results.push({
            workspaceId: workspace.id,
            ok: true,
            statementId: result.statement.id,
            targetStageLabel: result.targetStageLabel,
            changedCount: result.changes.length,
            skippedOverriddenCount: result.skippedOverridden.length,
            defaultedToNormal: result.defaultedToNormal,
          });
        } catch (error) {
          results.push({
            workspaceId: workspace.id,
            ok: false,
            error: error instanceof FeeError ? error.message : "Reprice failed",
          });
        }
      }

      try {
        await createFeeAuditLog({
          action: "FEE_STATEMENT_BATCH_GENERATED",
          performedByUserId: auth.user.id,
          registrationWindowId: data.registrationWindowId,
          note: "Batch reprice by current fee stage",
          metadata: {
            action: "batch-reprice-by-current-fee-stage",
            results,
          },
        });
      } catch (auditError) {
        console.error("Fee audit log failed:", auditError);
      }

      return NextResponse.json({ results });
    }

    if (data.action === "batch-restricted" && data.registrationWindowId) {
      const results = await runOfficeInvoiceBatch({
        registrationWindowId: data.registrationWindowId,
        registrationType: "RESTRICTED_INTERNAL",
        generate: generateRestrictedInvoice,
        generatedByUserId: auth.user.id,
        displayCurrency:
          (data.displayCurrency as "GBP" | "CNY" | "BOTH") ?? DEFAULT_FEE_STATEMENT_DISPLAY_CURRENCY,
        issue: Boolean(data.issue),
        statementKind: "RESTRICTED",
      });

      return NextResponse.json({ results });
    }

    if (data.action === "batch-external" && data.registrationWindowId) {
      const results = await runOfficeInvoiceBatch({
        registrationWindowId: data.registrationWindowId,
        registrationType: "EXTERNAL",
        generate: generateExternalInvoice,
        generatedByUserId: auth.user.id,
        displayCurrency:
          (data.displayCurrency as "GBP" | "CNY" | "BOTH") ?? DEFAULT_FEE_STATEMENT_DISPLAY_CURRENCY,
        issue: Boolean(data.issue),
        statementKind: "EXTERNAL",
      });

      return NextResponse.json({ results });
    }

    if (data.action === "regenerate-revised" && data.workspaceId) {
      const statement = await regenerateRevisedFeeStatement({
        workspaceId: data.workspaceId,
        generatedByUserId: auth.user.id,
        displayCurrency:
          (data.displayCurrency as "GBP" | "CNY" | "BOTH") ?? DEFAULT_FEE_STATEMENT_DISPLAY_CURRENCY,
      });

      await createFeeAuditLog({
        action: "FEE_STATEMENT_REGENERATED_REVISED",
        performedByUserId: auth.user.id,
        registrationWindowId: statement.registrationWindowId,
        metadata: { statementId: statement.id, statementNo: statement.statementNo },
      }).catch((auditError) => {
        console.error("Fee audit log failed:", auditError);
      });

      return NextResponse.json(statement, { status: 201 });
    }

    if (data.action === "reprice-by-current-fee-stage" && data.workspaceId) {
      const result = await repriceWorkspaceByCurrentFeeStage({
        workspaceId: data.workspaceId,
        performedByUserId: auth.user.id,
        displayCurrency:
          (data.displayCurrency as "GBP" | "CNY" | "BOTH") ?? DEFAULT_FEE_STATEMENT_DISPLAY_CURRENCY,
      });

      return NextResponse.json(
        {
          statement: result.statement,
          targetEntryType: result.targetEntryType,
          targetStageLabel: result.targetStageLabel,
          defaultedToNormal: result.defaultedToNormal,
          changes: result.changes,
          skippedOverridden: result.skippedOverridden,
        },
        { status: 201 },
      );
    }

    if (!data.workspaceId) {
      return jsonError("workspaceId is required");
    }

    const statement = await generateFeeStatement({
      workspaceId: data.workspaceId,
      generatedByUserId: auth.user.id,
      displayCurrency: (data.displayCurrency as "GBP" | "CNY" | "BOTH") ?? DEFAULT_FEE_STATEMENT_DISPLAY_CURRENCY,
      issue: Boolean(data.issue),
      regenerate: Boolean(data.regenerate),
    });

    await createFeeAuditLog({
      action: "FEE_STATEMENT_GENERATED",
      performedByUserId: auth.user.id,
      registrationWindowId: statement.registrationWindowId,
      metadata: { statementId: statement.id, issue: Boolean(data.issue) },
    }).catch((auditError) => {
      console.error("Fee audit log failed:", auditError);
    });

    return NextResponse.json(statement, { status: 201 });
  } catch (error) {
    console.error("Fee statement POST error:", error);
    if (error instanceof FeeError) {
      return jsonError(error.message, 400);
    }
    return jsonError(error instanceof Error ? error.message : "Fee statement request failed", 500);
  }
}
