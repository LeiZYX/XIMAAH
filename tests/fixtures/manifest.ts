import manifest from "./seed-manifest.json";

export type TestRole =
  | "admin"
  | "examOfficer"
  | "teacher"
  | "internalStudent"
  | "assistedStudent";

export const TEST_PASSWORD = manifest.password;

export const testAccounts = manifest.accounts;

export const testIds = manifest.ids;

export const testExamBoards = manifest.examBoards;

export function accountFor(role: TestRole) {
  const account = testAccounts[role];
  if (!account || !("homePath" in account)) {
    throw new Error(`Unknown test account role: ${role}`);
  }
  return account;
}
