import { describe, expect, it } from "vitest";
import { computeEdexcelRegistrationFeeRemovalGate } from "@/lib/registrations/edexcel-uci-registration";

describe("computeEdexcelRegistrationFeeRemovalGate", () => {
  it("blocks removal while subjects remain", () => {
    expect(
      computeEdexcelRegistrationFeeRemovalGate({
        activeSubjectCount: 1,
        uciEntrySnapshotCaptured: true,
        uciAtEntry: null,
        uciAllocatedBySystem: true,
        hasBulkEntriesBaseline: false,
      }),
    ).toEqual({
      allowed: false,
      clearUci: false,
      reason: "Candidate Registration Fee cannot be removed while exam subjects remain",
    });
  });

  it("allows fee removal and clears system-allocated UCI when entry was empty", () => {
    expect(
      computeEdexcelRegistrationFeeRemovalGate({
        activeSubjectCount: 0,
        uciEntrySnapshotCaptured: true,
        uciAtEntry: null,
        uciAllocatedBySystem: true,
        hasBulkEntriesBaseline: false,
      }),
    ).toEqual({ allowed: true, clearUci: true });
  });

  it("allows fee removal but keeps imported / pre-existing UCI", () => {
    expect(
      computeEdexcelRegistrationFeeRemovalGate({
        activeSubjectCount: 0,
        uciEntrySnapshotCaptured: true,
        uciAtEntry: "96834B250540",
        uciAllocatedBySystem: false,
        hasBulkEntriesBaseline: false,
      }),
    ).toEqual({ allowed: true, clearUci: false });
  });

  it("blocks clearing system UCI after Bulk Entries baseline", () => {
    expect(
      computeEdexcelRegistrationFeeRemovalGate({
        activeSubjectCount: 0,
        uciEntrySnapshotCaptured: true,
        uciAtEntry: null,
        uciAllocatedBySystem: true,
        hasBulkEntriesBaseline: true,
      }),
    ).toMatchObject({
      allowed: false,
      clearUci: false,
    });
  });

  it("still allows fee removal for imported UCI after baseline (UCI unchanged)", () => {
    expect(
      computeEdexcelRegistrationFeeRemovalGate({
        activeSubjectCount: 0,
        uciEntrySnapshotCaptured: true,
        uciAtEntry: "96834B250540",
        uciAllocatedBySystem: false,
        hasBulkEntriesBaseline: true,
      }),
    ).toEqual({ allowed: true, clearUci: false });
  });
});
