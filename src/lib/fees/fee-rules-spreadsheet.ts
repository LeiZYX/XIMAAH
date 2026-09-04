import type { FeeCurrency, FeeEntryType, FeeMarkupType } from "@/generated/prisma/enums";
import { getCalendarSubjectsForExamBoard } from "@/lib/calendar-subject-selections";
import { getSubjectsForRegistrationWindowSeries } from "@/lib/fees/fee-rules-series-sync";
import { prisma } from "@/lib/prisma";
import { STAGE_CODE_OPTIONS } from "@/lib/registrations/stage-labels";
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

/** Wide export: one subject per row (matches Fees UI). */
export interface SubjectFeeRuleWideExportRow {
  subjectCode: string;
  subjectName: string;
  qualification: string;
  normalCost: number;
  normalSales: number;
  lateCost: number;
  lateSales: number;
  highLateCost: number;
  highLateSales: number;
  currency: string;
  isActive: boolean;
}

/** Legacy long export (one row per entry stage). Still accepted on import. */
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

function toMoneyNumber(value: unknown): number {
  if (value === "" || value === null || value === undefined) return 0;
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function normalizeHeaderKey(key: string): string {
  return key.trim().toLowerCase().replace(/[\s_]+/g, "");
}

/** Map spreadsheet headers to canonical field names. */
export function normalizeFeeRuleImportRow(row: Record<string, unknown>): Record<string, unknown> {
  const aliases: Record<string, string> = {
    subjectcode: "subjectCode",
    code: "subjectCode",
    subject: "subjectCode",
    subjectname: "subjectName",
    name: "subjectName",
    qualification: "qualification",
    entrytype: "entryType",
    stage: "entryType",
    costcurrency: "costCurrency",
    costamount: "costAmount",
    cost: "costAmount",
    exchangeratetocny: "exchangeRateToCny",
    markuptype: "markupType",
    markupvalue: "markupValue",
    salescurrency: "salesCurrency",
    salesamount: "salesAmount",
    sales: "salesAmount",
    isactive: "isActive",
    active: "isActive",
    currency: "currency",
    normalcost: "normalCost",
    normalsales: "normalSales",
    latecost: "lateCost",
    latesales: "lateSales",
    highlatecost: "highLateCost",
    highlatesales: "highLateSales",
    high_late_cost: "highLateCost",
    high_late_sales: "highLateSales",
  };

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const canonical = aliases[normalizeHeaderKey(key)] ?? key;
    out[canonical] = value;
  }
  return out;
}

function isWideImportRow(row: Record<string, unknown>): boolean {
  return (
    row.normalCost !== undefined ||
    row.normalSales !== undefined ||
    row.lateCost !== undefined ||
    row.lateSales !== undefined ||
    row.highLateCost !== undefined ||
    row.highLateSales !== undefined
  );
}

export async function buildSubjectFeeRuleWideExportRows(
  registrationWindowId: string,
): Promise<SubjectFeeRuleWideExportRow[]> {
  const [{ subjects }, rules] = await Promise.all([
    getSubjectsForRegistrationWindowSeries(registrationWindowId),
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
  const bySubject = new Map<string, SubjectLevelRule[]>();
  for (const rule of subjectLevelRules) {
    if (!rule.subjectId) continue;
    const list = bySubject.get(rule.subjectId) ?? [];
    list.push(rule);
    bySubject.set(rule.subjectId, list);
  }

  type ExportSubject = {
    id: string;
    code: string;
    name: string;
    qualificationLabel: string;
  };

  const exportSubjects: ExportSubject[] = subjects.map((subject) => ({
    id: subject.id,
    code: subject.code,
    name: subject.name,
    qualificationLabel: `${subject.qualification.name} (${subject.qualification.level})`,
  }));

  const seen = new Set(exportSubjects.map((subject) => subject.id));
  for (const rule of subjectLevelRules) {
    if (!rule.subjectId || seen.has(rule.subjectId) || !rule.subject) continue;
    exportSubjects.push({
      id: rule.subjectId,
      code: rule.subject.code,
      name: rule.subject.name,
      qualificationLabel: `${rule.qualification.name} (${rule.qualification.level})`,
    });
    seen.add(rule.subjectId);
  }

  exportSubjects.sort((a, b) => a.code.localeCompare(b.code));

  return exportSubjects.map((subject) => {
    const subjectRules = bySubject.get(subject.id) ?? [];
    const byStage = Object.fromEntries(
      subjectRules.map((rule) => [rule.entryType, rule]),
    ) as Record<string, SubjectLevelRule | undefined>;

    const normal = byStage.NORMAL;
    const late = byStage.LATE;
    const high = byStage.HIGH_LATE;
    const any = normal ?? late ?? high;

    return {
      subjectCode: subject.code,
      subjectName: subject.name,
      qualification: subject.qualificationLabel,
      normalCost: toMoneyNumber(normal?.costAmount),
      normalSales: toMoneyNumber(normal?.salesAmount),
      lateCost: toMoneyNumber(late?.costAmount),
      lateSales: toMoneyNumber(late?.salesAmount),
      highLateCost: toMoneyNumber(high?.costAmount),
      highLateSales: toMoneyNumber(high?.salesAmount),
      currency: any?.costCurrency ?? any?.salesCurrency ?? "GBP",
      isActive: any?.isActive ?? true,
    };
  });
}

/** @deprecated Prefer buildSubjectFeeRuleWideExportRows */
export async function buildCalendarSubjectFeeRuleExportRows(
  registrationWindowId: string,
): Promise<CalendarSubjectFeeRuleExportRow[]> {
  const wide = await buildSubjectFeeRuleWideExportRows(registrationWindowId);
  const rows: CalendarSubjectFeeRuleExportRow[] = [];
  for (const item of wide) {
    for (const stage of STAGE_CODE_OPTIONS) {
      const cost =
        stage.value === "NORMAL"
          ? item.normalCost
          : stage.value === "LATE"
            ? item.lateCost
            : item.highLateCost;
      const sales =
        stage.value === "NORMAL"
          ? item.normalSales
          : stage.value === "LATE"
            ? item.lateSales
            : item.highLateSales;
      rows.push({
        subjectCode: item.subjectCode,
        subjectName: item.subjectName,
        qualification: item.qualification,
        entryType: stage.value,
        costCurrency: item.currency,
        costAmount: cost,
        exchangeRateToCny: "",
        markupType: "MANUAL",
        markupValue: "",
        salesCurrency: item.currency,
        salesAmount: sales,
        isActive: item.isActive,
      });
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

function parseMoneyOrZero(value: unknown): number {
  if (value === "" || value === null || value === undefined) return 0;
  return parseRequiredNumber(value, "amount");
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
        ? parseRequiredNumber(template.salesAmount ?? 0, "salesAmount")
        : parseOptionalNumber(template.salesAmount),
    isActive: template.isActive ?? true,
  };
}

function templateFromLegacyRow(row: Record<string, unknown>): FeeRuleTemplateInput {
  const entryType = parseEntryType(row.entryType);
  const markupType = parseMarkupType(row.markupType ?? "MANUAL");
  const costAmount = parseMoneyOrZero(row.costAmount);

  return {
    entryType,
    costCurrency: parseCurrency(row.costCurrency ?? row.currency, "GBP"),
    costAmount,
    exchangeRateToCny: parseOptionalNumber(row.exchangeRateToCny),
    markupType,
    markupValue: parseOptionalNumber(row.markupValue),
    salesCurrency: parseCurrency(row.salesCurrency ?? row.currency, "GBP"),
    salesAmount:
      markupType === "MANUAL"
        ? parseMoneyOrZero(row.salesAmount)
        : parseOptionalNumber(row.salesAmount),
    isActive: parseBoolean(row.isActive, true),
  };
}

function templatesFromWideRow(row: Record<string, unknown>): FeeRuleTemplateInput[] {
  const currency = parseCurrency(row.currency ?? row.costCurrency ?? row.salesCurrency, "GBP");
  const isActive = parseBoolean(row.isActive, true);

  return [
    {
      entryType: "NORMAL",
      costCurrency: currency,
      costAmount: parseMoneyOrZero(row.normalCost),
      markupType: "MANUAL",
      markupValue: null,
      salesCurrency: currency,
      salesAmount: parseMoneyOrZero(row.normalSales),
      isActive,
    },
    {
      entryType: "LATE",
      costCurrency: currency,
      costAmount: parseMoneyOrZero(row.lateCost),
      markupType: "MANUAL",
      markupValue: null,
      salesCurrency: currency,
      salesAmount: parseMoneyOrZero(row.lateSales),
      isActive,
    },
    {
      entryType: "HIGH_LATE",
      costCurrency: currency,
      costAmount: parseMoneyOrZero(row.highLateCost),
      markupType: "MANUAL",
      markupValue: null,
      salesCurrency: currency,
      salesAmount: parseMoneyOrZero(row.highLateSales),
      isActive,
    },
  ];
}

async function resolveSubjectForImport(
  registrationWindowId: string,
  examBoardId: string,
  subjectCode: string,
) {
  const { subjects: seriesSubjects } =
    await getSubjectsForRegistrationWindowSeries(registrationWindowId);
  const seriesHit = seriesSubjects.find((item) => item.code === subjectCode);
  if (seriesHit) {
    return {
      id: seriesHit.id,
      code: seriesHit.code,
      name: seriesHit.name,
      qualification: seriesHit.qualification,
    };
  }

  const calendarSubjects = await getCalendarSubjectsForExamBoard(examBoardId);
  const calendarHit = calendarSubjects.find((item) => item.code === subjectCode);
  if (calendarHit) {
    return {
      id: calendarHit.id,
      code: calendarHit.code,
      name: calendarHit.name,
      qualification: calendarHit.qualification,
    };
  }

  const dbSubject = await prisma.subject.findFirst({
    where: {
      code: subjectCode,
      qualification: { examBoardId },
    },
    select: {
      id: true,
      code: true,
      name: true,
      qualification: { select: { id: true, name: true, level: true } },
    },
  });
  if (dbSubject) {
    return {
      id: dbSubject.id,
      code: dbSubject.code,
      name: dbSubject.name,
      qualification: dbSubject.qualification,
    };
  }

  throw new Error(
    `Subject ${subjectCode} not found for this exam board / window series`,
  );
}

async function upsertStageRule(params: {
  registrationWindowId: string;
  examBoardId: string;
  examSeriesId: string;
  subject: {
    id: string;
    qualification: { id: string };
  };
  template: NormalizedFeeRuleTemplate;
  createdByUserId: string;
  existingRules: Array<{
    id: string;
    subjectId: string | null;
    entryType: FeeEntryType;
    paperId: string | null;
    examSessionId: string | null;
  }>;
}): Promise<"created" | "updated"> {
  const existing = params.existingRules.find(
    (rule) =>
      rule.subjectId === params.subject.id &&
      rule.entryType === params.template.entryType &&
      !rule.paperId &&
      !rule.examSessionId,
  );

  const data = {
    costCurrency: params.template.costCurrency,
    costAmount: params.template.costAmount,
    exchangeRateToCny: params.template.exchangeRateToCny,
    markupType: params.template.markupType,
    markupValue: params.template.markupValue,
    salesCurrency: params.template.salesCurrency,
    salesAmount: params.template.salesAmount,
    isActive: params.template.isActive,
  };

  if (existing) {
    await prisma.feeRule.update({
      where: { id: existing.id },
      data,
    });
    return "updated";
  }

  const created = await prisma.feeRule.create({
    data: {
      registrationWindowId: params.registrationWindowId,
      examBoardId: params.examBoardId,
      examSeriesId: params.examSeriesId,
      qualificationId: params.subject.qualification.id,
      subjectId: params.subject.id,
      paperId: null,
      examSessionId: null,
      entryType: params.template.entryType,
      createdByUserId: params.createdByUserId,
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
  params.existingRules.push(created);
  return "created";
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

  for (const [index, rawRow] of rows.entries()) {
    const row = normalizeFeeRuleImportRow(rawRow);
    const subjectCode = String(row.subjectCode ?? "").trim();
    if (!subjectCode) {
      result.skipped += 1;
      continue;
    }

    try {
      const subject = await resolveSubjectForImport(
        registrationWindowId,
        window.examBoardId,
        subjectCode,
      );

      const templates = isWideImportRow(row)
        ? templatesFromWideRow(row)
        : [templateFromLegacyRow(row)];

      for (const templateInput of templates) {
        const template = normalizeFeeRuleTemplateInput(templateInput);
        const outcome = await upsertStageRule({
          registrationWindowId,
          examBoardId: window.examBoardId,
          examSeriesId: window.examSeriesId,
          subject: {
            id: subject.id,
            qualification: { id: subject.qualification.id },
          },
          template,
          createdByUserId,
          existingRules,
        });
        if (outcome === "created") result.created += 1;
        else result.updated += 1;
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

export function feeRuleSpreadsheetToBuffer(
  rows: SubjectFeeRuleWideExportRow[] | CalendarSubjectFeeRuleExportRow[],
): Buffer {
  const sheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Subject Fees");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
