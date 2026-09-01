import * as XLSX from "xlsx";
import type { Candidate, Prisma } from "@/generated/prisma/client";
import type { Gender, Grade } from "@/generated/prisma/enums";
import { hashPassword } from "@/lib/auth/password";
import { generateAssessmentHubCandidateNumber } from "@/lib/candidates/service";
import { generateStudentId, rejectImportedStudentId } from "@/lib/candidates/student-id";
import { prisma } from "@/lib/prisma";
import {
  formatDateOfBirth,
  isValidEmail,
  parseDateOfBirthInput,
  parseGenderInput,
  parseGradeInput,
} from "@/lib/students/profile-enums";
import { composeLegalEnglishName, computeDisplayName } from "@/lib/candidates/identity";
import { logUserAudit } from "@/lib/users/audit";
import { INTERNAL_STUDENT_IMPORT_COLUMNS } from "@/lib/users/internal-student-import-template";

export interface InternalStudentImportRow {
  rowNumber: number;
  chineseName: string;
  preferredEnglishName?: string;
  firstName: string;
  lastName: string;
  englishName?: string;
  schoolStudentNumber?: string;
  pinyinLastName: string;
  pinyinFirstName: string;
  idNumber?: string;
  passportNumber?: string;
  gender: Gender;
  dateOfBirth: Date;
  grade: Grade;
  className: string;
  phone: string;
  email: string;
}

export interface InternalStudentImportError {
  row: number;
  message: string;
}

export interface InternalStudentImportPreviewItem {
  row: number;
  action: "create" | "update" | "skip";
  matchBy?: string;
  englishName: string;
  chineseName: string;
  email: string;
  grade: string;
  className: string;
}

const FORBIDDEN_IMPORT_HEADERS = new Set([
  "candidate number",
  "candidatenumber",
  "student id",
  "studentid",
  "uci number",
  "uci",
  "exam board candidate number",
  "centre number",
  "center number",
]);

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

const HEADER_ALIASES: Record<string, keyof Omit<InternalStudentImportRow, "rowNumber">> = {
  "chinese name": "chineseName",
  chinesename: "chineseName",
  "preferred english name": "preferredEnglishName",
  preferredenglishname: "preferredEnglishName",
  firstname: "firstName",
  "first name": "firstName",
  lastname: "lastName",
  "last name": "lastName",
  "english name": "englishName",
  englishname: "englishName",
  "school student number": "schoolStudentNumber",
  schoolstudentnumber: "schoolStudentNumber",
  "student number": "schoolStudentNumber",
  studentnumber: "schoolStudentNumber",
  "pinyin last name": "pinyinLastName",
  pinyinlastname: "pinyinLastName",
  "pinyin first name": "pinyinFirstName",
  pinyinfirstname: "pinyinFirstName",
  "id number": "idNumber",
  idnumber: "idNumber",
  "passport number": "passportNumber",
  passportnumber: "passportNumber",
  gender: "gender",
  "date of birth": "dateOfBirth",
  dateofbirth: "dateOfBirth",
  grade: "grade",
  class: "className",
  classname: "className",
  phone: "phone",
  email: "email",
};

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value > 30000 && value < 60000) {
      const date = parseDateOfBirthInput(value);
      if (date) return formatDateOfBirth(date);
    }
  }
  return String(value).trim();
}

function readSheetHeaders(sheet: XLSX.WorkSheet): string[] {
  const ref = sheet["!ref"];
  if (!ref) return [];
  const range = XLSX.utils.decode_range(ref);
  const headers: string[] = [];
  for (let col = range.s.c; col <= range.e.c; col += 1) {
    const cell = sheet[XLSX.utils.encode_cell({ r: range.s.r, c: col })];
    const value = cellText(cell?.v);
    if (value) headers.push(value);
  }
  return headers;
}

function dateOfBirthRange(date: Date): { gte: Date; lt: Date } {
  const gte = new Date(date);
  gte.setUTCHours(0, 0, 0, 0);
  const lt = new Date(gte);
  lt.setUTCDate(lt.getUTCDate() + 1);
  return { gte, lt };
}

function mapRow(
  raw: Record<string, unknown>,
  rowNumber: number,
): Partial<InternalStudentImportRow> & { rowNumber: number } {
  const mapped: Record<string, unknown> = { rowNumber };

  for (const [key, value] of Object.entries(raw)) {
    const field = HEADER_ALIASES[normalizeHeader(key)];
    if (field) mapped[field] = value;
  }

  return {
    rowNumber,
    chineseName: cellText(mapped.chineseName),
    preferredEnglishName: cellText(mapped.preferredEnglishName) || undefined,
    firstName: cellText(mapped.firstName),
    lastName: cellText(mapped.lastName),
    englishName: cellText(mapped.englishName) || undefined,
    schoolStudentNumber: cellText(mapped.schoolStudentNumber) || undefined,
    pinyinLastName: cellText(mapped.pinyinLastName),
    pinyinFirstName: cellText(mapped.pinyinFirstName),
    idNumber: cellText(mapped.idNumber) || undefined,
    passportNumber: cellText(mapped.passportNumber) || undefined,
    gender: parseGenderInput(mapped.gender),
    dateOfBirth: parseDateOfBirthInput(mapped.dateOfBirth),
    grade: parseGradeInput(mapped.grade),
    className: cellText(mapped.className),
    phone: cellText(mapped.phone),
    email: cellText(mapped.email),
  };
}

function isBlankRow(raw: Record<string, unknown>): boolean {
  return Object.values(raw).every((value) => cellText(value) === "");
}

function readImportSheet(buffer: ArrayBuffer) {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName =
    workbook.SheetNames.find((name) => normalizeHeader(name) === "internal students") ??
    workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return { sheet, sheetName };
}

export function validateInternalStudentImportHeaders(
  buffer: ArrayBuffer,
): InternalStudentImportError[] {
  const { sheet } = readImportSheet(buffer);
  const errors: InternalStudentImportError[] = [];

  for (const header of readSheetHeaders(sheet)) {
    const normalized = normalizeHeader(header);
    if (FORBIDDEN_IMPORT_HEADERS.has(normalized)) {
      errors.push({
        row: 1,
        message: `Column "${header}" is not allowed in this import`,
      });
    }
  }

  return errors;
}

export function parseInternalStudentImportWorkbook(
  buffer: ArrayBuffer,
): Array<Partial<InternalStudentImportRow> & { rowNumber: number }> {
  const { sheet } = readImportSheet(buffer);
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  return rawRows
    .map((row, index) => mapRow(row, index + 2))
    .filter((row, index) => !isBlankRow(rawRows[index]));
}

export function collectInternalStudentImportErrors(
  buffer: ArrayBuffer,
  rows: Array<Partial<InternalStudentImportRow> & { rowNumber: number }>,
): InternalStudentImportError[] {
  return [...validateInternalStudentImportHeaders(buffer), ...validateInternalStudentImportRows(rows)];
}

export function validateInternalStudentImportRows(
  rows: Array<Partial<InternalStudentImportRow> & { rowNumber: number }>,
): InternalStudentImportError[] {
  const errors: InternalStudentImportError[] = [];
  const seenEmails = new Set<string>();
  const seenPhones = new Set<string>();

  for (const row of rows) {
    const rowNum = row.rowNumber;

    try {
      rejectImportedStudentId((row as { studentId?: unknown }).studentId);
    } catch (error) {
      errors.push({
        row: rowNum,
        message: error instanceof Error ? error.message : "Student ID cannot be imported",
      });
    }

    if (!row.chineseName) errors.push({ row: rowNum, message: "Chinese Name is required" });
    const hasNameParts = Boolean(row.firstName?.trim() && row.lastName?.trim());
    const hasLegacyEnglishName = Boolean(row.englishName?.trim());
    if (!hasNameParts && !hasLegacyEnglishName) {
      errors.push({
        row: rowNum,
        message: "Firstname and Lastname are required (or English Name for legacy rows)",
      });
    }
    if (!row.pinyinLastName) errors.push({ row: rowNum, message: "Pinyin Last Name is required" });
    if (!row.pinyinFirstName) errors.push({ row: rowNum, message: "Pinyin First Name is required" });
    if (!row.gender) errors.push({ row: rowNum, message: "Gender is required" });
    if (!row.dateOfBirth) errors.push({ row: rowNum, message: "Date of Birth is required" });
    if (!row.grade) errors.push({ row: rowNum, message: "Grade must be one of G9, G10, G11, G12" });
    if (!row.className) errors.push({ row: rowNum, message: "Class is required" });
    if (!row.phone) errors.push({ row: rowNum, message: "Phone is required" });
    if (!row.email) errors.push({ row: rowNum, message: "Email is required" });
    if (row.email && !isValidEmail(row.email)) {
      errors.push({ row: rowNum, message: "Email format is invalid" });
    }
    if (row.email) {
      const key = row.email.toLowerCase();
      if (seenEmails.has(key)) errors.push({ row: rowNum, message: `Duplicate email ${row.email}` });
      seenEmails.add(key);
    }
    if (row.phone) {
      if (seenPhones.has(row.phone)) errors.push({ row: rowNum, message: `Duplicate phone ${row.phone}` });
      seenPhones.add(row.phone);
    }
  }

  return errors;
}

async function findMatchingCandidate(
  row: Pick<
    InternalStudentImportRow,
    "chineseName" | "dateOfBirth" | "email" | "phone" | "idNumber" | "passportNumber"
  >,
): Promise<{ candidate: Candidate | null; matchBy?: string }> {
  if (row.email) {
    const candidate = await prisma.candidate.findFirst({
      where: { email: row.email, candidateType: "INTERNAL" },
    });
    if (candidate) return { candidate, matchBy: "email" };
  }
  if (row.phone) {
    const candidate = await prisma.candidate.findFirst({
      where: { phone: row.phone, candidateType: "INTERNAL" },
    });
    if (candidate) return { candidate, matchBy: "phone" };
  }
  if (row.idNumber) {
    const candidate = await prisma.candidate.findFirst({
      where: { idNumber: row.idNumber, candidateType: "INTERNAL" },
    });
    if (candidate) return { candidate, matchBy: "idNumber" };
  }
  if (row.passportNumber) {
    const candidate = await prisma.candidate.findFirst({
      where: { passportNumber: row.passportNumber, candidateType: "INTERNAL" },
    });
    if (candidate) return { candidate, matchBy: "passportNumber" };
  }
  if (row.chineseName && row.dateOfBirth) {
    const dobRange = dateOfBirthRange(row.dateOfBirth);
    const matches = await prisma.candidate.findMany({
      where: {
        chineseName: row.chineseName,
        dateOfBirth: dobRange,
        candidateType: "INTERNAL",
      },
    });
    if (matches.length === 1) {
      return { candidate: matches[0], matchBy: "chineseName+dateOfBirth" };
    }
  }
  return { candidate: null };
}

function resolveImportNames(row: Pick<
  InternalStudentImportRow,
  "firstName" | "lastName" | "preferredEnglishName" | "englishName"
>) {
  let firstName = row.firstName?.trim() || "";
  let lastName = row.lastName?.trim() || "";
  const preferredEnglishName = row.preferredEnglishName?.trim() || null;
  const legacyEnglishName = row.englishName?.trim() || "";

  if ((!firstName || !lastName) && legacyEnglishName) {
    const parts = legacyEnglishName.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      firstName = firstName || parts[0];
      lastName = lastName || parts[0];
    } else if (parts.length >= 2) {
      firstName = firstName || parts.slice(0, -1).join(" ");
      lastName = lastName || parts[parts.length - 1];
    }
  }

  const legalEnglishName =
    composeLegalEnglishName({
      firstName,
      lastName,
      legalEnglishName: legacyEnglishName,
    }) || legacyEnglishName;
  const displayName = computeDisplayName({
    preferredEnglishName,
    firstName,
    lastName,
    legalEnglishName,
    englishName: legacyEnglishName,
  });

  return {
    firstName,
    lastName,
    preferredEnglishName,
    legalEnglishName,
    displayName,
  };
}

export async function previewInternalStudentImportRows(
  rows: InternalStudentImportRow[],
): Promise<InternalStudentImportPreviewItem[]> {
  const preview: InternalStudentImportPreviewItem[] = [];

  for (const row of rows) {
    const { candidate, matchBy } = await findMatchingCandidate(row);
    const names = resolveImportNames(row);
    preview.push({
      row: row.rowNumber,
      action: candidate ? "update" : "create",
      matchBy,
      englishName: names.displayName,
      chineseName: row.chineseName,
      email: row.email,
      grade: row.grade,
      className: row.className,
    });
  }

  return preview;
}

function profileLoginStudentNo(input: {
  schoolStudentNumber?: string;
  permanentStudentId: string;
}): string {
  return input.schoolStudentNumber?.trim() || input.permanentStudentId;
}

function candidateProfileUpdate(
  row: InternalStudentImportRow,
  extras: { schoolStudentNumber?: string; userId: string },
): Prisma.CandidateUncheckedUpdateInput {
  const names = resolveImportNames(row);
  return {
    candidateType: "INTERNAL",
    chineseName: row.chineseName,
    preferredEnglishName: names.preferredEnglishName,
    firstName: names.firstName,
    lastName: names.lastName,
    englishName: names.displayName,
    legalEnglishName: names.legalEnglishName,
    surnamePinyin: row.pinyinLastName,
    givenNamePinyin: row.pinyinFirstName,
    idNumber: row.idNumber ?? null,
    passportNumber: row.passportNumber ?? null,
    idDocumentNumber: row.idNumber ?? null,
    idDocumentType: row.idNumber ? "CHINESE_ID_CARD" : row.passportNumber ? "PASSPORT" : null,
    gender: row.gender,
    dateOfBirth: row.dateOfBirth,
    grade: row.grade,
    className: row.className,
    phone: row.phone,
    email: row.email,
    status: "ACTIVE",
    loginEnabled: true,
    studentNumber: extras.schoolStudentNumber ?? null,
    userId: extras.userId,
  };
}

async function upsertAuthForCandidate(
  row: InternalStudentImportRow,
  candidate: Candidate,
  passwordSeed: string,
) {
  const permanentStudentId = candidate.studentId ?? (await generateStudentId());
  const schoolStudentNumber = row.schoolStudentNumber?.trim() || candidate.studentNumber?.trim() || undefined;
  const profileStudentNo = profileLoginStudentNo({
    schoolStudentNumber,
    permanentStudentId,
  });

  if (candidate.userId) {
    const names = resolveImportNames(row);
    const user = await prisma.user.update({
      where: { id: candidate.userId },
      data: {
        name: names.displayName,
        email: row.email,
        phone: row.phone,
        studentNo: profileStudentNo,
        isActive: true,
        studentProfile: {
          update: {
            studentNo: profileStudentNo,
            currentGrade: row.grade,
            currentClassName: row.className,
            idCardNumber: row.idNumber ?? null,
            gender: row.gender,
            email: row.email,
            phone: row.phone,
            status: "ACTIVE",
          },
        },
      },
    });
    await prisma.candidate.update({
      where: { id: candidate.id },
      data: candidateProfileUpdate(row, {
        schoolStudentNumber,
        userId: user.id,
      }),
    });
    return user.id;
  }

  const names = resolveImportNames(row);
  const passwordHash = await hashPassword(passwordSeed);
  const user = await prisma.user.create({
    data: {
      name: names.displayName,
      email: row.email,
      phone: row.phone,
      studentNo: profileStudentNo,
      role: "STUDENT",
      passwordHash,
      mustChangePassword: true,
      studentProfile: {
        create: {
          studentNo: profileStudentNo,
          currentGrade: row.grade,
          currentClassName: row.className,
          idCardNumber: row.idNumber ?? null,
          gender: row.gender,
          email: row.email,
          phone: row.phone,
          status: "ACTIVE",
        },
      },
    },
  });

  await prisma.candidate.update({
    where: { id: candidate.id },
    data: candidateProfileUpdate(row, {
      schoolStudentNumber,
      userId: user.id,
    }),
  });

  return user.id;
}

export async function commitInternalStudentImportRows(
  rows: InternalStudentImportRow[],
  performedById: string,
) {
  let created = 0;
  let updated = 0;
  const skipped = 0;

  for (const row of rows) {
    rejectImportedStudentId((row as { studentId?: unknown }).studentId);

    const { candidate: existing, matchBy } = await findMatchingCandidate(row);

    if (existing) {
      const userId = await upsertAuthForCandidate(row, existing, row.email);
      await logUserAudit({
        action: "USER_UPDATED",
        performedById,
        targetUserId: userId,
        metadata: {
          source: "internal_student_import",
          matchBy,
          studentId: existing.studentId,
        },
      });
      updated += 1;
      continue;
    }

    const permanentStudentId = await generateStudentId();
    const schoolStudentNumber = row.schoolStudentNumber?.trim() || undefined;
    const profileStudentNo = profileLoginStudentNo({ schoolStudentNumber, permanentStudentId });
    const passwordHash = await hashPassword(row.email);
    const names = resolveImportNames(row);

    await prisma.user.create({
      data: {
        name: names.displayName,
        email: row.email,
        phone: row.phone,
        studentNo: profileStudentNo,
        role: "STUDENT",
        passwordHash,
        mustChangePassword: true,
        studentProfile: {
          create: {
            studentNo: profileStudentNo,
            currentGrade: row.grade,
            currentClassName: row.className,
            idCardNumber: row.idNumber ?? null,
            gender: row.gender,
            email: row.email,
            phone: row.phone,
            status: "ACTIVE",
          },
        },
        candidate: {
          create: {
            studentId: permanentStudentId,
            candidateType: "INTERNAL",
            assessmentHubCandidateNumber: generateAssessmentHubCandidateNumber(),
            studentNumber: schoolStudentNumber ?? null,
            chineseName: row.chineseName,
            preferredEnglishName: names.preferredEnglishName,
            firstName: names.firstName,
            lastName: names.lastName,
            englishName: names.displayName,
            legalEnglishName: names.legalEnglishName,
            surnamePinyin: row.pinyinLastName,
            givenNamePinyin: row.pinyinFirstName,
            idNumber: row.idNumber ?? null,
            passportNumber: row.passportNumber ?? null,
            idDocumentNumber: row.idNumber ?? null,
            idDocumentType: row.idNumber ? "CHINESE_ID_CARD" : row.passportNumber ? "PASSPORT" : null,
            gender: row.gender,
            dateOfBirth: row.dateOfBirth,
            grade: row.grade,
            className: row.className,
            phone: row.phone,
            email: row.email,
            status: "ACTIVE",
            loginEnabled: true,
            sourceSystem: "INTERNAL_STUDENT_IMPORT",
          },
        },
      },
    });

    await logUserAudit({
      action: "USER_CREATED",
      performedById,
      metadata: { source: "internal_student_import", permanentStudentId },
    });
    created += 1;
  }

  await logUserAudit({
    action: "STUDENT_IMPORTED",
    performedById,
    metadata: { created, updated, skipped, total: rows.length, format: "internal_student_v7" },
  });

  return { created, updated, skipped };
}

export function isCompleteInternalStudentImportRow(
  row: Partial<InternalStudentImportRow> & { rowNumber: number },
): row is InternalStudentImportRow {
  const hasNameParts = Boolean(row.firstName?.trim() && row.lastName?.trim());
  const hasLegacyEnglishName = Boolean(row.englishName?.trim());
  return Boolean(
    row.chineseName &&
      (hasNameParts || hasLegacyEnglishName) &&
      row.pinyinLastName &&
      row.pinyinFirstName &&
      row.gender &&
      row.dateOfBirth &&
      row.grade &&
      row.className &&
      row.phone &&
      row.email,
  );
}

export { INTERNAL_STUDENT_IMPORT_COLUMNS };
