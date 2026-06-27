import type { RegistrationAuditAction } from "@/generated/prisma/enums";
import {
  formatAdjusterLabel,
  parseAdjustmentSummary,
  type AdjustmentSummaryPayload,
} from "@/lib/registrations/workspace-display";

export interface AdjustmentHistoryBatch {
  adjustedAt: string;
  adjustedByName: string;
  adjustedByRole: string;
  reason: string;
  added: AdjustmentSummaryPayload["added"];
  removed: AdjustmentSummaryPayload["removed"];
  replaced: AdjustmentSummaryPayload["replaced"];
  requestedByName?: string;
  requestedByRole?: string;
  isLateRegistration?: boolean;
}

const POST_LOCK_ADJUSTMENT_ACTIONS = new Set<RegistrationAuditAction | string>([
  "EO_ADD_AFTER_LOCK",
  "EO_REMOVE_AFTER_LOCK",
  "EO_REPLACE_AFTER_LOCK",
  "ADMIN_ADD_AFTER_LOCK",
  "ADMIN_REMOVE_AFTER_LOCK",
  "ADMIN_REPLACE_AFTER_LOCK",
]);

function examLineFromSession(session: {
  paper: { code: string; title: string; subject: { name: string } };
}) {
  return {
    subject: session.paper.subject.name,
    paperCode: session.paper.code,
    paperTitle: session.paper.title,
  };
}

function isPostLockAdjustmentAction(action: string): boolean {
  return POST_LOCK_ADJUSTMENT_ACTIONS.has(action);
}

function batchKey(log: {
  performedBy: { name: string };
  reason: string | null;
  performedAt: string;
}) {
  const second = Math.floor(new Date(log.performedAt).getTime() / 1000);
  return `${log.performedBy.name}|${log.reason ?? ""}|${second}`;
}

export function buildPostLockAdjustmentHistoryFromAuditLogs(
  logs: Array<{
    action: string;
    performedAt: string;
    reason: string | null;
    note: string | null;
    performedBy: { name: string; role?: string | null };
    performedByRole?: string | null;
    examSession?: {
      paper: { code: string; title: string; subject: { name: string } };
    } | null;
  }>,
): AdjustmentHistoryBatch[] {
  const batches = new Map<string, AdjustmentHistoryBatch>();

  for (const log of logs) {
    if (!isPostLockAdjustmentAction(log.action)) continue;
    if (!log.examSession) continue;

    const key = batchKey(log);
    const existing = batches.get(key) ?? {
      adjustedAt: log.performedAt,
      adjustedByName: log.performedBy.name,
      adjustedByRole: log.performedByRole ?? log.performedBy.role ?? "",
      reason: log.reason ?? "",
      added: [],
      removed: [],
      replaced: [],
    };

    const line = examLineFromSession(log.examSession);

    if (log.action.endsWith("_ADD_AFTER_LOCK")) {
      existing.added.push(line);
    } else if (log.action.endsWith("_REMOVE_AFTER_LOCK")) {
      existing.removed.push(line);
    } else if (log.action.endsWith("_REPLACE_AFTER_LOCK")) {
      const replacementCode = log.note?.match(/Replaced with\s+(\S+)/i)?.[1];
      existing.replaced.push({
        from: line,
        to: {
          subject: line.subject,
          paperCode: replacementCode ?? "—",
          paperTitle: "",
        },
      });
    }

    batches.set(key, existing);
  }

  return [...batches.values()]
    .map((batch) => attachTeacherRequester(batch, logs))
    .sort(
      (a, b) => new Date(a.adjustedAt).getTime() - new Date(b.adjustedAt).getTime(),
    );
}

function attachTeacherRequester(
  batch: AdjustmentHistoryBatch,
  logs: Parameters<typeof buildPostLockAdjustmentHistoryFromAuditLogs>[0],
): AdjustmentHistoryBatch {
  if (batch.requestedByName) return batch;

  const teacherLog = logs
    .filter((log) => log.action === "TEACHER_CHANGE_REQUEST" && log.reason === batch.reason)
    .sort(
      (a, b) =>
        Math.abs(new Date(a.performedAt).getTime() - new Date(batch.adjustedAt).getTime()) -
        Math.abs(new Date(b.performedAt).getTime() - new Date(batch.adjustedAt).getTime()),
    )[0];

  if (!teacherLog) return batch;

  return {
    ...batch,
    requestedByName: teacherLog.performedBy.name,
    requestedByRole: teacherLog.performedByRole ?? teacherLog.performedBy.role ?? "SUBJECT_TEACHER",
  };
}

export function formatAdjustmentAttribution(batch: AdjustmentHistoryBatch): string {
  if (batch.isLateRegistration) {
    const creator = formatAdjusterLabel(batch.adjustedByName, batch.adjustedByRole);
    if (batch.requestedByName) {
      const teacher = formatAdjusterLabel(batch.requestedByName, batch.requestedByRole);
      return `Requested by ${teacher}; approved by ${creator}`;
    }
    return `Created by ${creator}`;
  }
  if (batch.requestedByName) {
    const teacher = formatAdjusterLabel(batch.requestedByName, batch.requestedByRole);
    const approver = formatAdjusterLabel(batch.adjustedByName, batch.adjustedByRole);
    return `Requested by ${teacher}; approved by ${approver}`;
  }
  return formatAdjusterLabel(batch.adjustedByName, batch.adjustedByRole);
}

export function formatAdjustmentHeading(batch: AdjustmentHistoryBatch, index: number, total: number): string {
  const suffix = total > 1 ? ` #${index + 1}` : "";
  if (batch.isLateRegistration) {
    if (batch.requestedByName) {
      const teacher = formatAdjusterLabel(batch.requestedByName, batch.requestedByRole);
      const approver = formatAdjusterLabel(batch.adjustedByName, batch.adjustedByRole);
      return `Late registration${suffix} — requested by ${teacher} approved by ${approver}`;
    }
    const approver = formatAdjusterLabel(batch.adjustedByName, batch.adjustedByRole);
    return `Late registration${suffix} — added by ${approver}`;
  }
  if (batch.requestedByName) {
    const teacher = formatAdjusterLabel(batch.requestedByName, batch.requestedByRole);
    const approver = formatAdjusterLabel(batch.adjustedByName, batch.adjustedByRole);
    return `Adjustment${suffix} — teacher request by ${teacher} approved by ${approver}`;
  }
  const role = adjusterRoleLabel(batch.adjustedByRole) || "Staff";
  return `Adjustment${suffix} by ${role}`;
}

export function parseStoredAdjustmentHistory(
  raw: string | null | undefined,
  fallback?: {
    lastAdjustedAt?: string | Date | null;
    lastAdjustedByName?: string | null;
    lastAdjustedByRole?: string | null;
    lastAdjustmentReason?: string | null;
  },
): AdjustmentHistoryBatch[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as
      | { version?: number; batches?: AdjustmentHistoryBatch[] }
      | AdjustmentSummaryPayload;

    if ("batches" in parsed && Array.isArray(parsed.batches)) {
      return parsed.batches.map((batch) => ({
        adjustedAt: batch.adjustedAt,
        adjustedByName: batch.adjustedByName,
        adjustedByRole: batch.adjustedByRole,
        reason: batch.reason ?? "",
        requestedByName: batch.requestedByName,
        requestedByRole: batch.requestedByRole,
        isLateRegistration: batch.isLateRegistration,
        added: batch.added ?? [],
        removed: batch.removed ?? [],
        replaced: batch.replaced ?? [],
      }));
    }

    const summary = parseAdjustmentSummary(raw);
    const hasChanges =
      summary.added.length > 0 || summary.removed.length > 0 || summary.replaced.length > 0;
    if (!hasChanges || !fallback?.lastAdjustedAt) return [];

    return [
      {
        adjustedAt: String(fallback.lastAdjustedAt),
        adjustedByName: fallback.lastAdjustedByName ?? "",
        adjustedByRole: fallback.lastAdjustedByRole ?? "",
        reason: fallback.lastAdjustmentReason ?? "",
        ...summary,
      },
    ];
  } catch {
    return [];
  }
}

export function serializeAdjustmentHistory(batches: AdjustmentHistoryBatch[]): string {
  return JSON.stringify({ version: 2, batches });
}

export function appendAdjustmentHistoryBatch(
  raw: string | null | undefined,
  batch: AdjustmentHistoryBatch,
  fallback?: Parameters<typeof parseStoredAdjustmentHistory>[1],
): string {
  const existing = parseStoredAdjustmentHistory(raw, fallback);
  return serializeAdjustmentHistory([...existing, batch]);
}

export function resolvePostLockAdjustmentHistory(input: {
  auditLogs?: Parameters<typeof buildPostLockAdjustmentHistoryFromAuditLogs>[0];
  lastAdjustmentSummary?: string | null;
  lastAdjustedAt?: string | Date | null;
  lastAdjustedByName?: string | null;
  lastAdjustedByRole?: string | null;
  lastAdjustmentReason?: string | null;
}): AdjustmentHistoryBatch[] {
  const fromAudit = input.auditLogs?.length
    ? buildPostLockAdjustmentHistoryFromAuditLogs(input.auditLogs)
    : [];

  if (fromAudit.length > 0) return fromAudit;

  const fromStored = parseStoredAdjustmentHistory(input.lastAdjustmentSummary, {
    lastAdjustedAt: input.lastAdjustedAt,
    lastAdjustedByName: input.lastAdjustedByName,
    lastAdjustedByRole: input.lastAdjustedByRole,
    lastAdjustmentReason: input.lastAdjustmentReason,
  });

  if (fromStored.length > 0 && input.auditLogs?.length) {
    return fromStored.map((batch) => attachTeacherRequester(batch, input.auditLogs!));
  }

  return fromStored;
}

export function adjusterRoleLabel(role: string | null | undefined): string {
  if (role === "EXAM_OFFICER") return "Exam Officer";
  if (role === "ADMIN") return "Admin";
  if (role === "SUBJECT_TEACHER") return "Subject Teacher";
  return role ?? "";
}
