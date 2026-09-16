import {
  StudentAdjustmentRequestItemType,
  StudentAdjustmentRequestStatus,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import {
  parseStoredAdjustmentHistory,
  serializeAdjustmentHistory,
  type AdjustmentHistoryBatch,
  type AdjustmentStudentReasonLine,
} from "@/lib/registrations/adjustment-history";

const sessionInclude = {
  paper: {
    include: {
      subject: true,
    },
  },
} as const;

const MATCH_WINDOW_MS = 10 * 60 * 1000;

function examLabel(session: {
  paper: { code: string; title: string; subject: { name: string } };
} | null | undefined): string {
  if (!session?.paper) return "—";
  const { paper } = session;
  return `${paper.subject.name} — ${paper.code}${paper.title ? ` ${paper.title}` : ""}`;
}

function examLine(session: {
  paper: { code: string; title: string; subject: { name: string } };
}) {
  return {
    subject: session.paper.subject.name,
    paperCode: session.paper.code,
    paperTitle: session.paper.title,
  };
}

export function legacyConcatenatedAdjustmentReason(
  eoReason: string | null | undefined,
  teacherReason: string | null | undefined,
): string {
  const eo = eoReason?.trim() ?? "";
  const teacher = teacherReason?.trim();
  if (!eo) return teacher ? `Teacher approval: ${teacher}` : "";
  if (!teacher) return eo;
  return `${eo} · Teacher approval: ${teacher}`;
}

function paperCodesFromBatch(batch: AdjustmentHistoryBatch): Set<string> {
  return new Set([
    ...batch.added.map((row) => row.paperCode),
    ...batch.removed.map((row) => row.paperCode),
    ...batch.replaced.flatMap((row) => [row.from.paperCode, row.to.paperCode]),
  ]);
}

function batchNeedsStudentRequestEnrichment(batch: AdjustmentHistoryBatch): boolean {
  if (batch.source === "STUDENT_REQUEST" && (batch.studentReasons?.length ?? 0) > 0) {
    return false;
  }
  return true;
}

function overlapCount(a: Set<string>, b: Set<string>): number {
  let count = 0;
  for (const value of a) {
    if (b.has(value)) count += 1;
  }
  return count;
}

export function scoreStudentRequestBatchMatch(input: {
  batch: AdjustmentHistoryBatch;
  eoReviewedAt: Date;
  eoReason: string;
  teacherReason: string | null;
  requestPaperCodes: Set<string>;
}): number {
  const { batch, eoReviewedAt, eoReason, teacherReason, requestPaperCodes } = input;

  let score = 0;
  const adjustedAt = new Date(batch.adjustedAt).getTime();
  const reviewedAt = eoReviewedAt.getTime();
  if (Number.isFinite(adjustedAt) && Number.isFinite(reviewedAt)) {
    const delta = Math.abs(adjustedAt - reviewedAt);
    if (delta <= MATCH_WINDOW_MS) {
      score += 50 - Math.floor(delta / 1000);
    } else {
      return -1;
    }
  }

  const papers = paperCodesFromBatch(batch);
  const overlap = overlapCount(papers, requestPaperCodes);
  if (requestPaperCodes.size > 0) {
    if (overlap === 0 && papers.size > 0) return -1;
    score += overlap * 20;
  }

  const legacy = legacyConcatenatedAdjustmentReason(eoReason, teacherReason);
  const reason = batch.reason?.trim() ?? "";
  if (legacy && reason === legacy) score += 40;
  else if (eoReason && reason === eoReason.trim()) score += 25;
  else if (legacy && reason.includes("Teacher approval:")) score += 10;

  return score;
}

export function enrichBatchFromStudentRequest(
  batch: AdjustmentHistoryBatch,
  input: {
    studentReasons: AdjustmentStudentReasonLine[];
    teacherApproval?: AdjustmentHistoryBatch["teacherApproval"];
    eoApproval?: AdjustmentHistoryBatch["eoApproval"];
    eoReason: string;
    teacherName?: string | null;
    teacherRole?: string | null;
  },
): AdjustmentHistoryBatch {
  return {
    ...batch,
    source: "STUDENT_REQUEST",
    reason: input.eoReason.trim() || batch.reason,
    studentReasons: input.studentReasons,
    teacherApproval: input.teacherApproval ?? batch.teacherApproval,
    eoApproval: input.eoApproval ?? batch.eoApproval,
    requestedByName: input.teacherName ?? batch.requestedByName,
    requestedByRole: input.teacherRole ?? batch.requestedByRole,
  };
}

export type StudentAdjustmentHistoryBackfillResult = {
  scannedRequests: number;
  workspacesTouched: number;
  batchesEnriched: number;
  batchesCreated: number;
  workspacesUpdated: number;
  skippedAlreadyStructured: number;
  unmatchedRequests: number;
};

export async function backfillStudentAdjustmentHistory(options: {
  apply: boolean;
}): Promise<StudentAdjustmentHistoryBackfillResult> {
  const requests = await prisma.studentAdjustmentRequest.findMany({
    where: { status: StudentAdjustmentRequestStatus.APPROVED },
    include: {
      teacherReviewedBy: { select: { name: true, role: true } },
      eoReviewedBy: { select: { name: true, role: true } },
      items: {
        include: {
          targetExamSession: { include: sessionInclude },
        },
        orderBy: { createdAt: "asc" },
      },
      registrationWorkspace: {
        select: {
          id: true,
          lastAdjustmentSummary: true,
          lastAdjustedAt: true,
          lastAdjustedByRole: true,
          lastAdjustmentReason: true,
          lastAdjustedByUser: { select: { name: true } },
        },
      },
    },
    orderBy: { eoReviewedAt: "asc" },
  });

  const removeRegistrationIds = [
    ...new Set(
      requests.flatMap((row) =>
        row.items
          .filter((item) => item.itemType === StudentAdjustmentRequestItemType.REMOVE)
          .map((item) => item.targetRegistrationId)
          .filter((id): id is string => Boolean(id)),
      ),
    ),
  ];

  const removeSessionByRegistrationId = new Map<
    string,
    {
      paper: { code: string; title: string; subject: { name: string } };
    } | null
  >();
  if (removeRegistrationIds.length > 0) {
    const registrations = await prisma.studentExamRegistration.findMany({
      where: { id: { in: removeRegistrationIds } },
      include: { examSession: { include: sessionInclude } },
    });
    for (const row of registrations) {
      removeSessionByRegistrationId.set(row.id, row.examSession);
    }
  }

  const result: StudentAdjustmentHistoryBackfillResult = {
    scannedRequests: requests.length,
    workspacesTouched: 0,
    batchesEnriched: 0,
    batchesCreated: 0,
    workspacesUpdated: 0,
    skippedAlreadyStructured: 0,
    unmatchedRequests: 0,
  };

  type WorkspaceBucket = {
    workspace: (typeof requests)[number]["registrationWorkspace"];
    requests: typeof requests;
  };

  const byWorkspace = new Map<string, WorkspaceBucket>();
  for (const request of requests) {
    const existing = byWorkspace.get(request.registrationWorkspaceId);
    if (existing) {
      existing.requests.push(request);
    } else {
      byWorkspace.set(request.registrationWorkspaceId, {
        workspace: request.registrationWorkspace,
        requests: [request],
      });
    }
  }

  for (const { workspace, requests: workspaceRequests } of byWorkspace.values()) {
    result.workspacesTouched += 1;

    let batches = parseStoredAdjustmentHistory(workspace.lastAdjustmentSummary, {
      lastAdjustedAt: workspace.lastAdjustedAt,
      lastAdjustedByName: workspace.lastAdjustedByUser?.name,
      lastAdjustedByRole: workspace.lastAdjustedByRole,
      lastAdjustmentReason: workspace.lastAdjustmentReason,
    });

    const usedBatchIndexes = new Set<number>();
    let changed = false;
    let nextLastAdjustmentReason = workspace.lastAdjustmentReason;

    for (const request of workspaceRequests) {
      const studentReasons: AdjustmentStudentReasonLine[] = request.items.map((item) => {
        const session =
          item.targetExamSession ??
          (item.targetRegistrationId
            ? removeSessionByRegistrationId.get(item.targetRegistrationId)
            : null);
        return {
          itemType: item.itemType === StudentAdjustmentRequestItemType.ADD ? "ADD" : "REMOVE",
          label:
            examLabel(session) !== "—"
              ? examLabel(session)
              : item.itemType === StudentAdjustmentRequestItemType.REMOVE
                ? `Remove registration ${item.targetRegistrationId ?? ""}`.trim()
                : "Add exam",
          reason: item.studentReason,
        };
      });

      const requestPaperCodes = new Set(
        request.items
          .map((item) => {
            const session =
              item.targetExamSession ??
              (item.targetRegistrationId
                ? removeSessionByRegistrationId.get(item.targetRegistrationId)
                : null);
            return session?.paper.code;
          })
          .filter((code): code is string => Boolean(code)),
      );

      const eoReason = request.eoReviewReason?.trim() || "";
      const teacherReason = request.teacherReviewReason?.trim() || null;
      const eoReviewedAt = request.eoReviewedAt ?? request.updatedAt;

      let bestIndex = -1;
      let bestScore = -1;
      let alreadyStructuredMatch = false;
      for (let index = 0; index < batches.length; index += 1) {
        if (usedBatchIndexes.has(index)) continue;
        const batch = batches[index]!;
        const score = scoreStudentRequestBatchMatch({
          batch,
          eoReviewedAt,
          eoReason,
          teacherReason,
          requestPaperCodes,
        });
        if (score < 0) continue;

        if (!batchNeedsStudentRequestEnrichment(batch)) {
          if (score >= 50) {
            usedBatchIndexes.add(index);
            result.skippedAlreadyStructured += 1;
            alreadyStructuredMatch = true;
            break;
          }
          continue;
        }

        if (score > bestScore) {
          bestScore = score;
          bestIndex = index;
        }
      }

      if (alreadyStructuredMatch) {
        continue;
      }

      const teacherApproval =
        request.teacherReviewedBy
          ? {
              decision: "Approved" as const,
              reason: teacherReason || "—",
              byName: request.teacherReviewedBy.name,
              byRole: request.teacherReviewedBy.role,
              at: (request.teacherReviewedAt ?? eoReviewedAt).toISOString(),
            }
          : undefined;
      const eoApproval = {
        decision: "Approved" as const,
        reason: eoReason || "—",
        byName: request.eoReviewedBy?.name ?? "",
        byRole: request.eoReviewedBy?.role ?? "EXAM_OFFICER",
        at: eoReviewedAt.toISOString(),
      };

      if (bestIndex >= 0 && bestScore >= 40) {
        usedBatchIndexes.add(bestIndex);
        batches[bestIndex] = enrichBatchFromStudentRequest(batches[bestIndex]!, {
          studentReasons,
          teacherApproval,
          eoApproval,
          eoReason: eoReason || batches[bestIndex]!.reason,
          teacherName: request.teacherReviewedBy?.name,
          teacherRole: request.teacherReviewedBy?.role,
        });
        result.batchesEnriched += 1;
        changed = true;
        if (eoReason) nextLastAdjustmentReason = eoReason;
        continue;
      }

      // No matching batch — create one from the approved request.
      const added = request.items
        .filter((item) => item.itemType === StudentAdjustmentRequestItemType.ADD && item.targetExamSession)
        .map((item) => examLine(item.targetExamSession!));
      const removed = request.items
        .filter((item) => item.itemType === StudentAdjustmentRequestItemType.REMOVE)
        .map((item) => {
          const session =
            item.targetExamSession ??
            (item.targetRegistrationId
              ? removeSessionByRegistrationId.get(item.targetRegistrationId)
              : null);
          return session ? examLine(session) : null;
        })
        .filter((row): row is ReturnType<typeof examLine> => Boolean(row));

      if (added.length === 0 && removed.length === 0) {
        result.unmatchedRequests += 1;
        continue;
      }

      batches.push({
        adjustedAt: eoReviewedAt.toISOString(),
        adjustedByName: request.eoReviewedBy?.name ?? "",
        adjustedByRole: request.eoReviewedBy?.role ?? "EXAM_OFFICER",
        reason: eoReason,
        added,
        removed,
        replaced: [],
        requestedByName: request.teacherReviewedBy?.name,
        requestedByRole: request.teacherReviewedBy?.role,
        source: "STUDENT_REQUEST",
        studentReasons,
        teacherApproval,
        eoApproval,
      });
      result.batchesCreated += 1;
      changed = true;
      if (eoReason) nextLastAdjustmentReason = eoReason;
    }

    if (!changed) continue;

    if (options.apply) {
      await prisma.registrationWorkspace.update({
        where: { id: workspace.id },
        data: {
          lastAdjustmentSummary: serializeAdjustmentHistory(batches),
          ...(nextLastAdjustmentReason != null
            ? { lastAdjustmentReason: nextLastAdjustmentReason }
            : {}),
        },
      });
      result.workspacesUpdated += 1;
    } else {
      result.workspacesUpdated += 1;
    }
  }

  return result;
}
