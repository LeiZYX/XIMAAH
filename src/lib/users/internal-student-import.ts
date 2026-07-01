import * as XLSX from "xlsx";
import type { Candidate, Prisma } from "@/generated/prisma/client";
import type { Gender, Grade } from "@/generated/prisma/enums";
import { hashPassword } from "@/lib/auth/password";
import { generateAssessmentHubCandidateNumber } from "@/lib/candidates/service";
import { generateStudentId } from "@/lib/candidates/student-id";
import { prisma } from "@/lib/prisma";
import {
  formatDateOfBirth,
  isValidEmail,
  parseDateOfBirthInput,
  parseGenderInput,
  parseGradeInput,
} from "@/lib/students/profile-enums";
import { logUserAudit } from "@/lib/users/audit";
import { INTERNAL_STUDENT_IMPORT_COLUMNS } from "@/lib/users/internal-student-import-template";

export interface InternalStudentImportRow {
  rowNumber: number;
  candidateNumber?: string;
  chineseName: string;
  englishName: string;
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

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

const HEADER_ALIASES: Record<string, keyof Omit<InternalStudentImportRow, "rowNumber">> = {
  "candidate number": "candidateNumber",
  candidatenumber: "candidateNumber",
  "chinese name": "chineseName",
  chinesename: "chineseName",
  "english name": "englishName",
  englishname: "englishName",
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
    candidateNumber: cellText(mapped.candidateNumber) || undefined,
    chineseName: cellText(mapped.chineseName),
    englishName: cellText(mapped.englishName),
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

export function parseInternalStudentImportWorkbook(
  buffer: ArrayBuffer,
): Array<Partial<InternalStudentImportRow> & { rowNumber: number }> {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName =
    workbook.SheetNames.find((name) => normalizeHeader(name) === "internal students") ??
    workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  return rawRows
    .map((row, index) => mapRow(row, index + 2))
    .filter((row, index) => !isBlankRow(rawRows[index]));
}

export function validateInternalStudentImportRows(
  rows: Array<Partial<InternalStudentImportRow> & { rowNumber: number }>,
): InternalStudentImportError[] {
  const errors: InternalStudentImportError[] = [];
  const seenEmails = new Set<string>();
  const seenPhones = new Set<string>();

  for (const row of rows) {
    const rowNum = row.rowNumber;
    if (!row.chineseName) errors.push({ row: rowNum, message: "Chinese Name is required" });
    if (!row.englishName) errors.push({ row: rowNum, message: "English Name is required" });
    if (!row.pinyinLastName) errors.push({ row: rowNum, message: "Pinyin Last Name is required" });
    if (!row.pinyinFirstName) errors.push({ row: rowNum, message: "Pinyin First Name is required" });
    if (!row.gender) errors.push({ row: rowNum, message: "Gender must be MALE, FEMALE, OTHER, or UNKNOWN" });
    if (!row.dateOfBirth) errors.push({ row: rowNum, message: "Date of Birth must be valid (YYYY-MM-DD)" });
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
    "candidateNumber" | "email" | "phone" | "idNumber" | "passportNumber"
  >,
): Promise<{ candidate: Candidate | null; matchBy?: string }> {
  if (row.candidateNumber) {
    const candidate = await prisma.candidate.findFirst({
      where: { assessmentHubCandidateNumber: row.candidateNumber },
    });
    if (candidate) return { candidate, matchBy: "candidateNumber" };
  }
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
  return { candidate: null };
}

export async function previewInternalStudentImportRows(
  rows: InternalStudentImportRow[],
): Promise<InternalStudentImportPreviewItem[]> {
  const preview: InternalStudentImportPreviewItem[] = [];

  for (const row of rows) {
    const { candidate, matchBy } = await findMatchingCandidate(row);
    preview.push({
      row: row.rowNumber,
      action: candidate ? "update" : "create",
      matchBy,
      englishName: row.englishName,
      chineseName: row.chineseName,
      email: row.email,
      grade: row.grade,
      className: row.className,
    });
  }

  return preview;
}

async function allocateStudentNo(email: string): Promise<string> {
  const base = email.split("@")[0]?.replace(/\W/g, "").slice(0, 12).toUpperCase() || "STU";
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const suffix = attempt === 0 ? "" : `-${attempt}`;
    const candidateNo = `${base}${suffix}`;
    const existing = await prisma.studentProfile.findUnique({ where: { studentNo: candidateNo } });
    if (!existing) return candidateNo;
  }
  return `STU-${Date.now()}`;
}

function candidateUncheckedUpdate(
  row: InternalStudentImportRow,
  extras: { studentNumber: string; userId: string },
): Prisma.CandidateUncheckedUpdateInput {
  return {
    candidateType: "INTERNAL",
    ...(row.candidateNumber ? { assessmentHubCandidateNumber: row.candidateNumber } : {}),
    chineseName: row.chineseName,
    englishName: row.englishName,
    legalEnglishName: row.englishName,
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
    studentNumber: extras.studentNumber,
    userId: extras.userId,
  };
}

async function upsertAuthForCandidate(
  row: InternalStudentImportRow,
  candidate: Candidate,
  passwordSeed: string,
) {
  const studentNo =
    candidate.studentNumber ??
    (await allocateStudentNo(row.email));

  if (candidate.userId) {
    const user = await prisma.user.update({
      where: { id: candidate.userId },
      data: {
        name: row.englishName,
        email: row.email,
        phone: row.phone,
        studentNo,
        isActive: true,
        studentProfile: {
          update: {
            studentNo,
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
      data: candidateUncheckedUpdate(row, { studentNumber: studentNo, userId: user.id }),
    });
    return user.id;
  }

  const passwordHash = await hashPassword(passwordSeed);
  const user = await prisma.user.create({
    data: {
      name: row.englishName,
      email: row.email,
      phone: row.phone,
      studentNo,
      role: "STUDENT",
      passwordHash,
      mustChangePassword: true,
      studentProfile: {
        create: {
          studentNo,
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
    data: candidateUncheckedUpdate(row, { studentNumber: studentNo, userId: user.id }),
  });

  return user.id;
}

export async function commitInternalStudentImportRows(
  rows: InternalStudentImportRow[],
  performedById: string,
) {
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const { candidate: existing, matchBy } = await findMatchingCandidate(row);

    if (existing) {
      const userId = await upsertAuthForCandidate(
        row,
        existing,
        existing.studentNumber ?? row.email,
      );
      await prisma.candidate.update({
        where: { id: existing.id },
        data: candidateUncheckedUpdate(row, {
          studentNumber: existing.studentNumber ?? (await allocateStudentNo(row.email)),
          userId,
        }),
      });
      await logUserAudit({
        action: "USER_UPDATED",
        performedById,
        targetUserId: userId,
        metadata: { source: "internal_student_import", matchBy },
      });
      updated += 1;
      continue;
    }

    const studentNo = await allocateStudentNo(row.email);
    const assessmentHubCandidateNumber =
      row.candidateNumber ?? generateAssessmentHubCandidateNumber();
    const passwordHash = await hashPassword(studentNo);
    const studentId = await generateStudentId();

    const user = await prisma.user.create({
      data: {
        name: row.englishName,
        email: row.email,
        phone: row.phone,
        studentNo,
        role: "STUDENT",
        passwordHash,
        mustChangePassword: true,
        studentProfile: {
          create: {
            studentNo,
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
            studentId,
            candidateType: "INTERNAL",
            assessmentHubCandidateNumber,
            studentNumber: studentNo,
            chineseName: row.chineseName,
            englishName: row.englishName,
            legalEnglishName: row.englishName,
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
      targetUserId: user.id,
      metadata: { source: "internal_student_import" },
    });
    created += 1;
  }

  await logUserAudit({
    action: "STUDENT_IMPORTED",
    performedById,
    metadata: { created, updated, skipped, total: rows.length, format: "internal_student_v2" },
  });

  return { created, updated, skipped };
}

export function isCompleteInternalStudentImportRow(
  row: Partial<InternalStudentImportRow> & { rowNumber: number },
): row is InternalStudentImportRow {
  return Boolean(
    row.chineseName &&
      row.englishName &&
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
