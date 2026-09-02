export const BULK_SPEC_SLOTS = 32;

export const BULK_ENTRIES_FIXED_HEADERS = [
  "UCI Number",
  "Candidate Number",
  "Firstname",
  "Lastname",
  "Gender(M or F)",
  "DOB(dd/mm/yyyy)",
  "Unique Learner Number",
  "Status(Centre - 0, Private - 1, Guest - 2)",
  "Parent Centre",
  "Candidate Number at Parent Centre",
] as const;

export const BULK_ENTRIES_HEADERS = [
  ...BULK_ENTRIES_FIXED_HEADERS,
  ...Array.from({ length: BULK_SPEC_SLOTS }, (_, index) => `Specification${index + 1}`),
  ...Array.from({ length: BULK_SPEC_SLOTS }, (_, index) => `SpecOption${index + 1}`),
] as const;
