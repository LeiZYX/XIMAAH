import { describe, expect, it } from "vitest";
import { parseBaselineSnapshot } from "@/lib/board-submissions/baseline";
import {
  AMENDMENT_ADD_SLOTS,
  AMENDMENT_REMOVE_SLOTS,
} from "@/lib/board-submissions/amendment/constants";
import { diffEntryLists, entryKey } from "@/lib/board-submissions/entry-utils";
import type { BulkEntrySlot } from "@/lib/board-submissions/bulk-entries/types";

function chunk(entries: BulkEntrySlot[], size: number): BulkEntrySlot[][] {
  const chunks: BulkEntrySlot[][] = [];
  for (let index = 0; index < entries.length; index += size) {
    chunks.push(entries.slice(index, index + size));
  }
  return chunks;
}

describe("diffEntryLists", () => {
  it("returns adds and removes relative to baseline", () => {
    const baseline = [
      { specification: "WMA11", specOption: "01" },
      { specification: "WPH14", specOption: "01" },
    ];
    const current = [
      { specification: "WMA11", specOption: "01" },
      { specification: "WCH13", specOption: "01" },
    ];

    const result = diffEntryLists(baseline, current);
    expect(result.adds).toEqual([{ specification: "WCH13", specOption: "01" }]);
    expect(result.removes).toEqual([{ specification: "WPH14", specOption: "01" }]);
  });
});

describe("parseBaselineSnapshot", () => {
  it("parses stored baseline rows", () => {
    const rows = parseBaselineSnapshot([
      {
        candidateId: "c1",
        entries: [{ specification: "WMA11", specOption: "01" }],
      },
    ]);

    expect(rows).toEqual([
      {
        candidateId: "c1",
        entries: [{ specification: "WMA11", specOption: "01" }],
      },
    ]);
  });
});

describe("amendment row chunking", () => {
  it("chunks add entries into rows of two", () => {
    const entries = Array.from({ length: 5 }, (_, index) => ({
      specification: `SPEC${index + 1}`,
      specOption: `OPT${index + 1}`,
    }));

    const chunks = chunk(entries, AMENDMENT_ADD_SLOTS);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(2);
    expect(chunks[2]).toHaveLength(1);
    expect(entryKey(chunks[0]![0]!)).toBe("SPEC1::OPT1");
  });

  it("chunks remove entries into rows of five", () => {
    const entries = Array.from({ length: 6 }, (_, index) => ({
      specification: `SPEC${index + 1}`,
      specOption: `OPT${index + 1}`,
    }));

    const chunks = chunk(entries, AMENDMENT_REMOVE_SLOTS);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(5);
    expect(chunks[1]).toHaveLength(1);
  });
});
