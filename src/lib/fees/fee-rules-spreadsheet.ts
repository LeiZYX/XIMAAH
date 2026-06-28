import { getCalendarSubjectsForExamBoard } from "@/lib/calendar-subject-selections";
import type { FeeCurrency, FeeEntryType, FeeMarkupType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

export interface FeeRuleTemplateInput {
  entryType?: FeeEntryType;
  costCurrency?: FeeCurrency;
  costAmount: number | string;
  exchangeRateToCny?: number | string | null;
  markupType?: FeeMarkupType;
  markupValue?: number | string | null;
  salesCurrency?: FeeCurrency;
  salesAmount?: number | string | null;
  isActive?: boolean;
}

export interface CalendarSubjectFeeRuleExportRow {
  subjectCode: string;
  subjectName: string;
  qualification: string;
  entryType: string;
  costCurrency: string;
  costAmount: number | "";
  exchangeRateToCny: number | "";
  markupType: string;
  markupValue: number | "";
  salesCurrency: string;
  salesAmount: number | "";
  isActive: boolean | "";
}

export interface FeeRuleImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

type SubjectLevelRule = {
  id: string;
  subjectId: string | null;
  entryType: FeeEntryType;
  paperId: string | null;
  examSessionId: string | null;
  costCurrency: FeeCurrency;
  costAmount: unknown;
  exchangeRateToCny: unknown;
  markupType: FeeMarkupType;
  markupValue: unknown;
  salesCurrency: FeeCurrency;
  salesAmount: unknown;
  isActive: boolean;
  subject: { code: string; name: string } | null;
  qualification: { name: string; level: string };
};

function isSubjectLevelRule(rule: SubjectLevelRule) {
  return Boolean(rule.subjectId) && !rule.paperId && !rule.examSessionId;
}

function ruleToExportRow(rule: SubjectLevelRule): CalendarSubjectFeeRuleExportRow {
  return {
    subjectCode: rule.subject?.code ?? "",
    subjectName: rule.subject?.name ?? "",
    qualification: `${rule.qualification.name} (${rule.qualification.level})`,
    entryType: rule.entryType,
    costCurrency: rule.costCurrency,
    costAmount: Number(rule.costAmount),
    exchangeRateToCny: rule.exchangeRateToCny ? Number(rule.exchangeRateToCny) : "",
    markupType: rule.markupType,
    markupValue: rule.markupValue ? Number(rule.markupValue) : "",
    salesCurrency: rule.salesCurrency,
    salesAmount: rule.salesAmount ? Number(rule.salesAmount) : "",
    isActive: rule.isActive,
  };
}

function emptyExportRow(
  subject: Awaited<ReturnType<typeof getCalendarSubjectsForExamBoard>>[number],
  entryType: FeeEntryType,
): CalendarSubjectFeeRuleExportRow {
  return {
    subjectCode: subject.code,
    subjectName: subject.name,
    qualification: `${subject.qualification.name} (${subject.qualification.level})`,
    entryType,
    costCurrency: "GBP",
    costAmount: "",
    exchangeRateToCny: "",
    markupType: "PERCENTAGE",
    markupValue: "",
    salesCurrency: "GBP",
    salesAmount: "",
    isActive: true,
  };
}

export async function buildCalendarSubjectFeeRuleExportRows(
  registrationWindowId: string,
): Promise<CalendarSubjectFeeRuleExportRow[]> {
  const window = await prisma.registrationWindow.findUnique({
    where: { id: registrationWindowId },
    select: { examBoardId: true },
  });
  if (!window) return [];

  const [subjects, rules] = await Promise.all([
    getCalendarSubjectsForExamBoard(window.examBoardId),
    prisma.feeRule.findMany({
      where: { registrationWindowId },
      include: {
        subject: { select: { code: true, name: true } },
        qualification: { select: { name: true, level: true } },
      },
      orderBy: [{ subject: { code: "asc" } }, { entryType: "asc" }],
    }),
  ]);

  const subjectLevelRules = rules.filter(isSubjectLevelRule) as SubjectLevelRule[];
  const rulesBySubjectId = new Map<string, SubjectLevelRule[]>();
  for (const rule of subjectLevelRules) {
    if (!rule.subjectId) continue;
    const existing = rulesBySubjectId.get(rule.subjectId) ?? [];
    existing.push(rule);
    rulesBySubjectId.set(rule.subjectId, existing);
  }

  const rows: CalendarSubjectFeeRuleExportRow[] = [];
  for (const subject of subjects) {
    const subjectRules = rulesBySubjectId.get(subject.id) ?? [];
    if (subjectRules.length === 0) {
      rows.push(emptyExportRow(subject, "NORMAL"));
      continue;
    }
    for (const rule of subjectRules) {
      rows.push(ruleToExportRow(rule));
    }
  }

  return rows;
}

function parseEntryType(value: unknown): FeeEntryType {
  const normalized = String(value ?? "NORMAL").trim().toUpperCase();
  if (normalized === "LATE" || normalized === "HIGH_LATE" || normalized === "NORMAL") {
    return normalized;
  }
  throw new Error(`Invalid entry type: ${value}`);
}

function parseCurrency(value: unknown, fallback: FeeCurrency): FeeCurrency {
  const normalized = String(value ?? fallback).trim().toUpperCase();
  if (normalized === "GBP" || normalized === "CNY") return normalized;
  throw new Error(`Invalid currency: ${value}`);
}

function parseMarkupType(value: unknown): FeeMarkupType {
  const normalized = String(value ?? "PERCENTAGE").trim().toUpperCase();
  if (
    normalized === "PERCENTAGE" ||
    normalized === "FIXED_AMOUNT" ||
    normalized === "MANUAL"
  ) {
    return normalized;
  }
  throw new Error(`Invalid markup type: ${value}`);
}

function parseBoolean(value: unknown, fallback = true): boolean {
  if (value === "" || value === null || value === undefined) return fallback;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true" || normalized === "yes" || normalized === "1") return true;
  if (normalized === "false" || normalized === "no" || normalized === "0") return false;
  return fallback;
}

function parseOptionalNumber(value: unknown): number | null {
  if (value === "" || value === null || value === undefined) return null;
  const num = Number(value);
  if (Number.isNaN(num)) throw new Error(`Invalid number: ${value}`);
  return num;
}

function parseRequiredNumber(value: unknown, field: string): number {
  if (value === "" || value === null || value === undefined) {
    throw new Error(`${field} is required`);
  }
  const num = Number(value);
  if (Number.isNaN(num)) throw new Error(`Invalid ${field}: ${value}`);
  return num;
}

export interface NormalizedFeeRuleTemplate {
  entryType: FeeEntryType;
  costCurrency: FeeCurrency;
  costAmount: number;
  exchangeRateToCny: number | null;
  markupType: FeeMarkupType;
  markupValue: number | null;
  salesCurrency: FeeCurrency;
  salesAmount: number | null;
  isActive: boolean;
}

export function normalizeFeeRuleTemplateInput(
  template: FeeRuleTemplateInput,
): NormalizedFeeRuleTemplate {
  const entryType = template.entryType ?? "NORMAL";
  const markupType = template.markupType ?? "PERCENTAGE";

  return {
    entryType,
    costCurrency: template.costCurrency ?? "GBP",
    costAmount: parseRequiredNumber(template.costAmount, "costAmount"),
    exchangeRateToCny: parseOptionalNumber(template.exchangeRateToCny),
    markupType,
    markupValue: parseOptionalNumber(template.markupValue),
    salesCurrency: template.salesCurrency ?? "GBP",
    salesAmount:
      markupType === "MANUAL"
        ? parseRequiredNumber(template.salesAmount, "salesAmount")
        : parseOptionalNumber(template.salesAmount),
    isActive: template.isActive ?? true,
  };
}

function templateFromRow(row: Record<string, unknown>): FeeRuleTemplateInput {
  const entryType = parseEntryType(row.entryType);
  const markupType = parseMarkupType(row.markupType);
  const costAmount = parseRequiredNumber(row.costAmount, "costAmount");

  return {
    entryType,
    costCurrency: parseCurrency(row.costCurrency, "GBP"),
    costAmount,
    exchangeRateToCny: parseOptionalNumber(row.exchangeRateToCny),
    markupType,
    markupValue: parseOptionalNumber(row.markupValue),
    salesCurrency: parseCurrency(row.salesCurrency, "GBP"),
    salesAmount:
      markupType === "MANUAL"
        ? parseRequiredNumber(row.salesAmount, "salesAmount")
        : parseOptionalNumber(row.salesAmount),
    isActive: parseBoolean(row.isActive, true),
  };
}

async function resolveCalendarSubjectForImport(
  examBoardId: string,
  row: Record<string, unknown>,
) {
  const subjectCode = String(row.subjectCode ?? "").trim();
  if (!subjectCode) {
    throw new Error("subjectCode is required");
  }

  const calendarSubjects = await getCalendarSubjectsForExamBoard(examBoardId);
  const subject = calendarSubjects.find((item) => item.code === subjectCode);
  if (!subject) {
    throw new Error(`Subject ${subjectCode} is not a calendar subject for this exam board`);
  }

  return subject;
}

export async function upsertCalendarSubjectFeeRulesFromRows(
  registrationWindowId: string,
  rows: Record<string, unknown>[],
  createdByUserId: string,
): Promise<FeeRuleImportResult> {
  const window = await prisma.registrationWindow.findUnique({
    where: { id: registrationWindowId },
    select: { id: true, examBoardId: true, examSeriesId: true },
  });
  if (!window) {
    throw new Error("Registration window not found");
  }

  const existingRules = await prisma.feeRule.findMany({
    where: { registrationWindowId },
    select: {
      id: true,
      subjectId: true,
      entryType: true,
      paperId: true,
      examSessionId: true,
    },
  });

  const result: FeeRuleImportResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  for (const [index, row] of rows.entries()) {
    const subjectCode = String(row.subjectCode ?? "").trim();
    if (!subjectCode) {
      result.skipped += 1;
      continue;
    }

    try {
      const subject = await resolveCalendarSubjectForImport(window.examBoardId, row);
      const template = normalizeFeeRuleTemplateInput(templateFromRow(row));
      const existing = existingRules.find(
        (rule) =>
          rule.subjectId === subject.id &&
          rule.entryType === template.entryType &&
          !rule.paperId &&
          !rule.examSessionId,
      );

      const data = {
        costCurrency: template.costCurrency,
        costAmount: template.costAmount,
        exchangeRateToCny: template.exchangeRateToCny,
        markupType: template.markupType,
        markupValue: template.markupValue,
        salesCurrency: template.salesCurrency,
        salesAmount: template.salesAmount,
        isActive: template.isActive,
      };

      if (existing) {
        await prisma.feeRule.update({
          where: { id: existing.id },
          data,
        });
        result.updated += 1;
      } else {
        const created = await prisma.feeRule.create({
          data: {
            registrationWindowId,
            examBoardId: window.examBoardId,
            examSeriesId: window.examSeriesId,
            qualificationId: subject.qualification.id,
            subjectId: subject.id,
            paperId: null,
            examSessionId: null,
            entryType: template.entryType,
            createdByUserId,
            ...data,
          },
          select: {
            id: true,
            subjectId: true,
            entryType: true,
            paperId: true,
            examSessionId: true,
          },
        });
        existingRules.push(created);
        result.created += 1;
      }
    } catch (error) {
      result.errors.push(
        `Row ${index + 2}: ${error instanceof Error ? error.message : "Import failed"}`,
      );
    }
  }

  return result;
}

export async function bulkCreateCalendarSubjectFeeRules(
  registrationWindowId: string,
  template: FeeRuleTemplateInput,
  createdByUserId: string,
): Promise<{ created: number; skipped: number }> {
  const window = await prisma.registrationWindow.findUnique({
    where: { id: registrationWindowId },
    select: { id: true, examBoardId: true, examSeriesId: true },
  });
  if (!window) {
    throw new Error("Registration window not found");
  }

  const entryType = template.entryType ?? "NORMAL";
  const normalized = normalizeFeeRuleTemplateInput(template);
  const [subjects, existingRules] = await Promise.all([
    getCalendarSubjectsForExamBoard(window.examBoardId),
    prisma.feeRule.findMany({
      where: {
        registrationWindowId,
        entryType,
        paperId: null,
        examSessionId: null,
        subjectId: { not: null },
      },
      select: { subjectId: true },
    }),
  ]);

  const existingSubjectIds = new Set(
    existingRules.map((rule) => rule.subjectId).filter(Boolean) as string[],
  );

  const toCreate = subjects.filter((subject) => !existingSubjectIds.has(subject.id));
  if (toCreate.length === 0) {
    return { created: 0, skipped: subjects.length };
  }

  await prisma.feeRule.createMany({
    data: toCreate.map((subject) => ({
      registrationWindowId,
      examBoardId: window.examBoardId,
      examSeriesId: window.examSeriesId,
      qualificationId: subject.qualification.id,
      subjectId: subject.id,
      paperId: null,
      examSessionId: null,
      entryType: normalized.entryType,
      costCurrency: normalized.costCurrency,
      costAmount: normalized.costAmount,
      exchangeRateToCny: normalized.exchangeRateToCny,
      markupType: normalized.markupType,
      markupValue: normalized.markupValue,
      salesCurrency: normalized.salesCurrency,
      salesAmount: normalized.salesAmount,
      isActive: normalized.isActive,
      createdByUserId,
    })),
  });

  return { created: toCreate.length, skipped: subjects.length - toCreate.length };
}

export function feeRuleSpreadsheetToBuffer(rows: CalendarSubjectFeeRuleExportRow[]): Buffer {
  const sheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Calendar Subject Fees");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
