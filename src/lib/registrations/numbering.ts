import type { Prisma } from "@/generated/prisma/client";
import type { RegistrationType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export type RegistrationNumberPrefix = "IN" | "RI" | "EX";
export type DocumentNumberKind = "REG" | "FS" | "IC";

export {
  normalizeRegistrationType,
  isInternalNormalRegistrationType,
  isRestrictedInternalRegistrationType,
  isOfficeOnlyRegistrationType,
  isStudentVisibleRegistrationType,
  billingScopeForRegistrationType,
  feeStatementStudentVisible,
  statementKindForRegistrationType,
} from "@/lib/registrations/registration-type";

type NumberingClient = Prisma.TransactionClient | typeof prisma;

const REGISTRATION_TYPE_PREFIX: Record<RegistrationType, RegistrationNumberPrefix> = {
  INTERNAL_NORMAL: "IN",
  RESTRICTED_INTERNAL: "RI",
  EXTERNAL: "EX",
};

export function registrationNumberPrefix(type: RegistrationType): RegistrationNumberPrefix {
  return REGISTRATION_TYPE_PREFIX[type];
}

function documentPrefix(kind: DocumentNumberKind, registrationType: RegistrationType): string {
  const scope = registrationNumberPrefix(registrationType);
  return `${kind}-${scope}`;
}

export function registrationNumberPattern(
  registrationType: RegistrationType,
  year: number,
): string {
  return `${documentPrefix("REG", registrationType)}-${year}-`;
}

export function feeStatementNumberPattern(
  registrationType: RegistrationType,
  year: number,
): string {
  return `${documentPrefix("FS", registrationType)}-${year}-`;
}

export function confirmationNumberPattern(
  registrationType: RegistrationType,
  year: number,
): string {
  return `${documentPrefix("IC", registrationType)}-${year}-`;
}

export function formatRegistrationNumber(
  registrationType: RegistrationType,
  year: number,
  sequence: number,
): string {
  return `${registrationNumberPattern(registrationType, year)}${String(sequence).padStart(6, "0")}`;
}

export function formatFeeStatementNumber(
  registrationType: RegistrationType,
  year: number,
  sequence: number,
): string {
  return `${feeStatementNumberPattern(registrationType, year)}${String(sequence).padStart(6, "0")}`;
}

export function formatConfirmationNumber(
  registrationType: RegistrationType,
  year: number,
  sequence: number,
): string {
  return `${confirmationNumberPattern(registrationType, year)}${String(sequence).padStart(6, "0")}`;
}

function parseDocumentSequence(documentNumber: string, pattern: string): number | null {
  if (!documentNumber.startsWith(pattern)) return null;
  const suffix = documentNumber.slice(pattern.length);
  if (!/^\d{6}$/.test(suffix)) return null;
  const sequence = Number.parseInt(suffix, 10);
  return Number.isNaN(sequence) ? null : sequence;
}

async function maxRegistrationSequence(
  registrationType: RegistrationType,
  year: number,
  client: NumberingClient = prisma,
): Promise<number> {
  const pattern = registrationNumberPattern(registrationType, year);
  const rows = await client.registrationWorkspace.findMany({
    where: { registrationNumber: { startsWith: pattern } },
    select: { registrationNumber: true },
  });

  let max = 0;
  for (const row of rows) {
    if (!row.registrationNumber) continue;
    const sequence = parseDocumentSequence(row.registrationNumber, pattern);
    if (sequence !== null && sequence > max) {
      max = sequence;
    }
  }
  return max;
}

export async function generateRegistrationNumber(
  registrationType: RegistrationType,
  year = new Date().getFullYear(),
  client: NumberingClient = prisma,
): Promise<string> {
  const nextSequence = (await maxRegistrationSequence(registrationType, year, client)) + 1;
  return formatRegistrationNumber(registrationType, year, nextSequence);
}

/**
 * Backfill workspaces missing registrationNumber using REG-IN-YYYY-######.
 * Legacy rows are treated as internal normal; sequence increments per calendar year.
 */
export async function backfillRegistrationNumbers(client: NumberingClient = prisma): Promise<number> {
  const missing = await client.registrationWorkspace.findMany({
    where: { registrationNumber: null },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, createdAt: true },
  });

  let updated = 0;
  for (const workspace of missing) {
    const year = workspace.createdAt.getFullYear();
    const registrationNumber = await generateRegistrationNumber("INTERNAL_NORMAL", year, client);
    await client.registrationWorkspace.update({
      where: { id: workspace.id },
      data: { registrationNumber },
    });
    updated += 1;
  }

  return updated;
}

async function maxFeeStatementSequence(
  registrationType: RegistrationType,
  year: number,
  client: NumberingClient = prisma,
): Promise<number> {
  const pattern = feeStatementNumberPattern(registrationType, year);
  const rows = await client.feeStatement.findMany({
    where: { statementNo: { startsWith: pattern } },
    select: { statementNo: true },
  });

  let max = 0;
  for (const row of rows) {
    const sequence = parseDocumentSequence(row.statementNo, pattern);
    if (sequence !== null && sequence > max) {
      max = sequence;
    }
  }
  return max;
}

export async function generateFeeStatementNumber(
  registrationType: RegistrationType,
  year = new Date().getFullYear(),
  client: NumberingClient = prisma,
): Promise<string> {
  const nextSequence = (await maxFeeStatementSequence(registrationType, year, client)) + 1;
  return formatFeeStatementNumber(registrationType, year, nextSequence);
}

async function maxConfirmationSequence(
  registrationType: RegistrationType,
  year: number,
  client: NumberingClient = prisma,
): Promise<number> {
  const pattern = confirmationNumberPattern(registrationType, year);
  const rows = await client.registrationWorkspace.findMany({
    where: { confirmationNumber: { startsWith: pattern } },
    select: { confirmationNumber: true },
  });

  let max = 0;
  for (const row of rows) {
    if (!row.confirmationNumber) continue;
    const sequence = parseDocumentSequence(row.confirmationNumber, pattern);
    if (sequence !== null && sequence > max) {
      max = sequence;
    }
  }
  return max;
}

export async function generateConfirmationNumber(
  registrationType: RegistrationType,
  year = new Date().getFullYear(),
  client: NumberingClient = prisma,
): Promise<string> {
  const nextSequence = (await maxConfirmationSequence(registrationType, year, client)) + 1;
  return formatConfirmationNumber(registrationType, year, nextSequence);
}

/**
 * Backfill confirmation numbers for locked workspaces missing IC-##-YYYY-######.
 */
export async function backfillConfirmationNumbers(client: NumberingClient = prisma): Promise<number> {
  const missing = await client.registrationWorkspace.findMany({
    where: { confirmationNumber: null, lockedAt: { not: null } },
    orderBy: [{ lockedAt: "asc" }, { id: "asc" }],
    select: { id: true, lockedAt: true, registrationType: true },
  });

  let updated = 0;
  for (const workspace of missing) {
    const year = workspace.lockedAt!.getFullYear();
    const confirmationNumber = await generateConfirmationNumber(
      workspace.registrationType,
      year,
      client,
    );
    await client.registrationWorkspace.update({
      where: { id: workspace.id },
      data: { confirmationNumber },
    });
    updated += 1;
  }

  return updated;
}
