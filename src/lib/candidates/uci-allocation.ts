import { normalizeExamBoardKey } from "@/lib/candidates/exam-board-identity.shared";

/** UCI shape used for Edexcel registration-fee and allocation rules. */
export type UciShape = "EMPTY" | "PROVISIONAL_OR_LEGACY" | "CONFIRMED";

export function classifyUciNumber(uci: string | null | undefined): UciShape {
  const value = uci?.trim() ?? "";
  if (!value) return "EMPTY";
  if (/[A-Za-z]$/.test(value)) return "CONFIRMED";
  return "PROVISIONAL_OR_LEGACY";
}

/** Charge Candidate Registration Fee when UCI is missing or not board-confirmed (no trailing letter). */
export function needsCandidateRegistrationFeeForUci(uci: string | null | undefined): boolean {
  const shape = classifyUciNumber(uci);
  return shape === "EMPTY" || shape === "PROVISIONAL_OR_LEGACY";
}

export function examBoardUsesEdexcelUciRules(
  boardCode: string | null | undefined,
  boardName?: string | null,
): boolean {
  if (!boardCode && !boardName) return false;
  return normalizeExamBoardKey(boardCode ?? "", boardName) === "EDEXCEL";
}

/**
 * Internal provisional UCI: Centre + B + last 6 characters of school student number.
 * Example: centre 96834 + XM250233 → 96834B250233
 */
export function deriveInternalProvisionalUci(
  centreNumber: string | null | undefined,
  schoolStudentNumber: string | null | undefined,
): string {
  const centre = centreNumber?.trim() ?? "";
  const schoolNo = schoolStudentNumber?.trim() ?? "";
  if (!centre) {
    throw new Error("Centre Number is required to allocate a provisional UCI");
  }
  if (schoolNo.length < 6) {
    throw new Error(
      "School Student Number must be at least 6 characters to allocate a provisional UCI",
    );
  }
  const suffix = schoolNo.slice(-6);
  if (!/^\d{6}$/.test(suffix)) {
    throw new Error(
      "School Student Number last 6 characters must be digits to allocate a provisional UCI",
    );
  }
  return `${centre}B${suffix}`;
}

export function isValidProvisionalUciFormat(
  uci: string | null | undefined,
  centreNumber?: string | null,
): boolean {
  const value = uci?.trim() ?? "";
  if (!value) return false;
  const centre = centreNumber?.trim();
  if (centre) {
    return new RegExp(`^${escapeRegExp(centre)}B\\d{6}$`).test(value);
  }
  return /^[A-Za-z0-9]+B\d{6}$/.test(value);
}

export function isValidConfirmedUciFormat(
  uci: string | null | undefined,
  centreNumber?: string | null,
): boolean {
  const value = uci?.trim() ?? "";
  if (!value) return false;
  const centre = centreNumber?.trim();
  if (centre) {
    return new RegExp(`^${escapeRegExp(centre)}B\\d{6}[A-Za-z]$`).test(value);
  }
  return /^[A-Za-z0-9]+B\d{6}[A-Za-z]$/.test(value);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
