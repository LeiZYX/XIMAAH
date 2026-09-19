import type { UserRole } from "@/lib/auth/constants";

export function examOfficerCanConfigureFeeRules(): boolean {
  return process.env.EXAM_OFFICER_CAN_CONFIGURE_FEE_RULES === "true";
}

export function studentFeeStatementsEnabled(): boolean {
  return process.env.STUDENT_FEE_STATEMENTS_ENABLED !== "false";
}

export function canConfigureFeeRules(role: UserRole): boolean {
  if (role === "ADMIN") return true;
  if (role === "EXAM_OFFICER") return examOfficerCanConfigureFeeRules();
  return false;
}

export function canGenerateFeeStatements(role: UserRole): boolean {
  return role === "ADMIN" || role === "EXAM_OFFICER" || role === "FINANCE";
}

export function canRepriceFeeStatements(role: UserRole): boolean {
  return role === "ADMIN" || role === "EXAM_OFFICER";
}

/** Manual refund recording. Exam Officer can view refund due, not record it. */
export function canRecordFeeRefunds(role: UserRole): boolean {
  return role === "ADMIN" || role === "FINANCE";
}

export function canViewFeeRuleCosts(role: UserRole): boolean {
  return role === "ADMIN" || (role === "EXAM_OFFICER" && examOfficerCanConfigureFeeRules());
}

export function canViewStudentFeeStatements(role: UserRole): boolean {
  return role === "STUDENT" && studentFeeStatementsEnabled();
}
