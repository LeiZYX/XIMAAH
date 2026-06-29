import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canGenerateFeeStatements } from "@/lib/auth/permissions";
import { createFeeAuditLog } from "@/lib/fees/audit";
import {
  FeeError,
  generateFeeStatement,
  issueFeeStatement,
  validateWorkspaceFees,
} from "@/lib/fees/statement";
import {
  hasIssuedFeeStatement,
  needsFeeStatementRegeneration,
} from "@/lib/fees/workspace-status";
import { DEFAULT_FEE_STATEMENT_DISPLAY_CURRENCY } from "@/lib/fees/display-currency";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;
  if (!canGenerateFeeStatements(auth.user.role)) {
    return jsonError("Forbidden", 403);
  }

  const registrationWindowId = request.nextUrl.searchParams.get("registrationWindowId");
  const workspaceId = request.nextUrl.searchParams.get("workspaceId");

  const statements = await prisma.feeStatement.findMany({
    where: {
      ...(registrationWindowId ? { registrationWindowId } : {}),
      ...(workspaceId ? { registrationWorkspaceId: workspaceId } : {}),
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
    orderBy: [{ generatedAt: "desc" }],
  });

  if (workspaceId) {
    const workspace = await prisma.registrationWorkspace.findUnique({
      where: { id: workspaceId },
      select: { lastAdjustedAt: true },
    });

    const meta = {
      needsRegeneration: needsFeeStatementRegeneration(
        statements,
        workspace?.lastAdjustedAt ?? null,
      ),
      hasIssuedStatement: hasIssuedFeeStatement(statements),
      lastAdjustedAt: workspace?.lastAdjustedAt?.toISOString() ?? null,
    };

    return NextResponse.json({ statements, meta });
  }

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
  }>(body, []);

  if (!data) return jsonError("Invalid body");

  try {
    if (data.action === "issue" && data.statementId) {
      const statement = await issueFeeStatement(data.statementId);
      return NextResponse.json(statement);
    }

    if (data.action === "validate" && data.workspaceId) {
      const result = await validateWorkspaceFees(data.workspaceId);
      return NextResponse.json(result);
    }

    if (data.action === "batch" && data.registrationWindowId) {
      const workspaces = await prisma.registrationWorkspace.findMany({
        where: {
          registrationWindowId: data.registrationWindowId,
          lockedAt: { not: null },
        },
      });

      const results: {
        workspaceId: string;
        ok: boolean;
        error?: string;
        statementId?: string;
        skipped?: boolean;
      }[] = [];

      for (const workspace of workspaces) {
        try {
          if (!data.regenerate) {
            const existingDraft = await prisma.feeStatement.findFirst({
              where: {
                registrationWorkspaceId: workspace.id,
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

            const existingIssued = await prisma.feeStatement.findFirst({
              where: {
                registrationWorkspaceId: workspace.id,
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
            regenerate: Boolean(data.regenerate),
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
