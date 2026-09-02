import { describe, expect, it } from "vitest";
import {
  buildBulkEntriesFileParts,
  buildBulkEntriesSnapshot,
} from "@/lib/board-submissions/bulk-entries/build";
import type { BulkEntriesCandidateRow } from "@/lib/board-submissions/bulk-entries/types";

function makeRow(entryCount: number): BulkEntriesCandidateRow {
  const entries = Array.from({ length: entryCount }, (_, index) => ({
    specification: `SPEC${index + 1}`,
    specOption: `OPT${index + 1}`,
  }));
  return {
    candidateId: `c-${entryCount}`,
    displayName: `Candidate ${entryCount}`,
    candidateType: "Internal",
    registrationTypes: ["INTERNAL_NORMAL"],
    uciNumber: "UCI123",
    candidateNumber: "001",
    firstName: "Test",
    lastName: "User",
    gender: "M",
    dateOfBirth: "01/01/2010",
    entries,
    issues: [],
    filePartCount: Math.ceil(entryCount / 32) || 1,
  };
}

describe("buildBulkEntriesFileParts", () => {
  it("keeps all candidates in one file when entries fit in 32 slots", () => {
    const parts = buildBulkEntriesFileParts([makeRow(5), makeRow(10)]);
    expect(parts).toHaveLength(1);
    expect(parts[0]?.rowCount).toBe(2);
    expect(parts[0]?.rows[0]?.entries).toHaveLength(5);
  });

  it("splits overflow candidates into additional files", () => {
    const parts = buildBulkEntriesFileParts([makeRow(40)]);
    expect(parts).toHaveLength(2);
    expect(parts[0]?.rows[0]?.entries).toHaveLength(32);
    expect(parts[1]?.rows[0]?.entries).toHaveLength(8);
  });
});

describe("buildBulkEntriesSnapshot", () => {
  it("stores full entry lists per candidate", () => {
    const snapshot = buildBulkEntriesSnapshot([makeRow(3)]);
    expect(snapshot).toEqual([
      {
        candidateId: "c-3",
        entries: [
          { specification: "SPEC1", specOption: "OPT1" },
          { specification: "SPEC2", specOption: "OPT2" },
          { specification: "SPEC3", specOption: "OPT3" },
        ],
      },
    ]);
  });
});
